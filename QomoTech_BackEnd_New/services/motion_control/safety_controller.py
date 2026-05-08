"""安全控制器 —— 运动指令准入闸。

所有运动 API 在调用 ZMC 适配器之前，必须先通过本类的 检查 方法。
违规时抛 SafetyViolation —— routers/motion_http.py 已约定将其转为 HTTP 400。

职责拆分：
  - 静态校验：轴名是否合法、列表长度是否一致、方向是否 ±1
  - 软限位：目标位置是否落在 [soft_limit_neg, soft_limit_pos] 区间
  - 速度归一：用户传 None 或越界值时，clamp 到 axis.max_speed / 0
  - 状态准入：当前 运动状态 是否允许下发指令（IDLE/MOVING 可，ESTOP/ALARM/DISCONNECTED 不可）
  - 配置准入：require_home_before_run 等 motion_config.safety 中的策略
"""

from __future__ import annotations

from typing import Iterable, List, Optional, Sequence, Set

from services.motion_control.config_loader import 运动配置, 轴配置
from services.motion_control.models import 运动状态


class SafetyViolation(Exception):
    """运动指令未通过安全检查。

    routers/motion_http.py 把这个异常翻译为 HTTP 400 BAD_REQUEST。
    """


# 允许下发新运动指令的状态
_可运动状态: Set[运动状态] = {运动状态.IDLE, 运动状态.MOVING, 运动状态.HOMING}

# 允许下发"软停止/急停/复位"等控制指令的状态
_可停止状态: Set[运动状态] = {
    运动状态.IDLE, 运动状态.MOVING, 运动状态.HOMING,
    运动状态.PAUSED, 运动状态.ESTOP, 运动状态.ALARM,
}


class 安全控制器:
    """无状态校验器 —— 所有 检查 方法都把当前 运动状态 作为入参传入。"""

    def __init__(self, 配置: 运动配置) -> None:
        self._配置 = 配置

    # ------------------------------------------------------------------
    # 静态校验
    # ------------------------------------------------------------------

    def 校验轴名(self, 轴名: str) -> 轴配置:
        if 轴名 not in self._配置.轴:
            raise SafetyViolation(
                f"未配置的轴 {轴名!r}，可选: {self._配置.轴名列表}"
            )
        return self._配置.取轴(轴名)

    def 校验轴名列表(self, 轴名列表: Sequence[str]) -> List[轴配置]:
        if not 轴名列表:
            raise SafetyViolation("轴列表为空")
        if len(set(轴名列表)) != len(轴名列表):
            raise SafetyViolation(f"轴列表存在重复: {list(轴名列表)}")
        return [self.校验轴名(名) for 名 in 轴名列表]

    def 校验长度匹配(self, 轴名列表: Sequence[str], 数值列表: Sequence[float], 标签: str) -> None:
        if len(轴名列表) != len(数值列表):
            raise SafetyViolation(
                f"{标签} 与轴列表长度不一致：{len(轴名列表)} vs {len(数值列表)}"
            )

    def 校验方向(self, 方向: int) -> int:
        if 方向 not in (-1, 1):
            raise SafetyViolation(f"非法 JOG 方向: {方向}（应为 +1 或 -1）")
        return 方向

    # ------------------------------------------------------------------
    # 软限位
    # ------------------------------------------------------------------

    def 校验软限位(self, 轴名: str, 目标位置: float) -> None:
        cfg = self.校验轴名(轴名)
        if 目标位置 > cfg.软限位正:
            raise SafetyViolation(
                f"轴 {轴名} 目标 {目标位置} 超出正软限位 {cfg.软限位正}"
            )
        if 目标位置 < cfg.软限位负:
            raise SafetyViolation(
                f"轴 {轴名} 目标 {目标位置} 超出负软限位 {cfg.软限位负}"
            )

    def 校验多轴软限位(self, 轴名列表: Sequence[str], 目标位置列表: Sequence[float]) -> None:
        for 名, 位置 in zip(轴名列表, 目标位置列表):
            self.校验软限位(名, 位置)

    def 校验相对位移(self, 轴名: str, 当前位置: float, 距离: float) -> None:
        """相对运动需要叠加当前位置后做软限位校验。"""
        self.校验软限位(轴名, 当前位置 + 距离)

    # ------------------------------------------------------------------
    # 速度归一
    # ------------------------------------------------------------------

    def 归一化速度(self, 轴名: str, 速度: Optional[float]) -> float:
        """传 None → 取 max_speed；越界 → clamp 到 [0, max_speed]。"""
        cfg = self.校验轴名(轴名)
        if 速度 is None:
            return cfg.最大速度
        if 速度 < 0:
            raise SafetyViolation(f"轴 {轴名} 速度不能为负: {速度}")
        if 速度 == 0:
            raise SafetyViolation(f"轴 {轴名} 速度不能为 0")
        return min(float(速度), cfg.最大速度)

    def 归一化多轴速度(self, 轴名列表: Sequence[str], 速度: Optional[float]) -> float:
        """多轴插补共享一个进给速度，按所有参与轴的最低 max_speed 上限 clamp。"""
        if not 轴名列表:
            raise SafetyViolation("轴列表为空")
        上限 = min(self.校验轴名(名).最大速度 for 名 in 轴名列表)
        if 速度 is None:
            return 上限
        if 速度 <= 0:
            raise SafetyViolation(f"插补速度必须大于 0: {速度}")
        return min(float(速度), 上限)

    # ------------------------------------------------------------------
    # 状态准入
    # ------------------------------------------------------------------

    def 准入_运动指令(self, 当前: 运动状态) -> None:
        """通用：能否下发任何"运动开始"类型的指令。"""
        if 当前 == 运动状态.DISCONNECTED:
            raise SafetyViolation("控制器未连接")
        if 当前 in (运动状态.ESTOP, 运动状态.ALARM):
            raise SafetyViolation(f"当前状态 {当前.value}，需先调用 复位 清除")
        if 当前 == 运动状态.PAUSED:
            raise SafetyViolation("当前已暂停，请先 继续 或 停止")
        if 当前 not in _可运动状态:
            raise SafetyViolation(f"当前状态 {当前.value} 不允许下发运动指令")

    def 准入_点动(self, 当前: 运动状态) -> None:
        """点动只允许在 IDLE 下开始（避免与缓冲指令冲突）。"""
        if 当前 == 运动状态.DISCONNECTED:
            raise SafetyViolation("控制器未连接")
        if 当前 in (运动状态.ESTOP, 运动状态.ALARM):
            raise SafetyViolation(f"当前状态 {当前.value}，需先调用 复位 清除")
        if 当前 != 运动状态.IDLE:
            raise SafetyViolation(f"点动只能从 IDLE 开始，当前 {当前.value}")

    def 准入_回零(self, 当前: 运动状态) -> None:
        if 当前 == 运动状态.DISCONNECTED:
            raise SafetyViolation("控制器未连接")
        if 当前 in (运动状态.ESTOP, 运动状态.ALARM):
            raise SafetyViolation(f"当前状态 {当前.value}，需先调用 复位 清除")
        if 当前 != 运动状态.IDLE:
            raise SafetyViolation(f"回零只能从 IDLE 开始，当前 {当前.value}")

    def 准入_停止类(self, 当前: 运动状态) -> None:
        """停止/急停/复位等控制指令。比运动指令宽松，PAUSED/ESTOP/ALARM 也允许。"""
        if 当前 == 运动状态.DISCONNECTED:
            raise SafetyViolation("控制器未连接")
        if 当前 not in _可停止状态:
            raise SafetyViolation(f"当前状态 {当前.value} 不允许该指令")

    def 准入_暂停(self, 当前: 运动状态) -> None:
        if 当前 == 运动状态.DISCONNECTED:
            raise SafetyViolation("控制器未连接")
        if 当前 != 运动状态.MOVING:
            raise SafetyViolation(f"暂停只能在 MOVING 状态触发，当前 {当前.value}")

    def 准入_继续(self, 当前: 运动状态) -> None:
        if 当前 == 运动状态.DISCONNECTED:
            raise SafetyViolation("控制器未连接")
        if 当前 != 运动状态.PAUSED:
            raise SafetyViolation(f"继续只能在 PAUSED 状态触发，当前 {当前.value}")

    # ------------------------------------------------------------------
    # 复合检查（一次性完成多项校验）
    # ------------------------------------------------------------------

    def 检查单轴绝对(
        self, 当前: 运动状态, 轴名: str, 位置: float, 速度: Optional[float],
    ) -> tuple[轴配置, float]:
        self.准入_运动指令(当前)
        cfg = self.校验轴名(轴名)
        self.校验软限位(轴名, 位置)
        return cfg, self.归一化速度(轴名, 速度)

    def 检查直线插补(
        self,
        当前: 运动状态,
        轴名列表: Sequence[str],
        位置列表: Sequence[float],
        速度: Optional[float],
        相对: bool,
        当前位置: Optional[Sequence[float]] = None,
    ) -> tuple[List[轴配置], float]:
        """直线插补 —— 多轴一致性 + 软限位 + 速度归一。

        相对模式下若提供 当前位置，会做累加后的软限位校验；不提供则跳过软限位（保持兼容性）。
        """
        self.准入_运动指令(当前)
        self.校验长度匹配(轴名列表, 位置列表, "位置/距离列表")
        cfgs = self.校验轴名列表(轴名列表)
        if 相对:
            if 当前位置 is not None:
                self.校验长度匹配(轴名列表, 当前位置, "当前位置列表")
                for 名, 起, 距 in zip(轴名列表, 当前位置, 位置列表):
                    self.校验相对位移(名, float(起), float(距))
        else:
            self.校验多轴软限位(轴名列表, 位置列表)
        return cfgs, self.归一化多轴速度(轴名列表, 速度)

    def 检查点动(
        self, 当前: 运动状态, 轴名: str, 方向: int, 速度: Optional[float],
    ) -> tuple[轴配置, int, float]:
        self.准入_点动(当前)
        cfg = self.校验轴名(轴名)
        self.校验方向(方向)
        return cfg, 方向, self.归一化速度(轴名, 速度)

    def 检查回零(
        self, 当前: 运动状态, 轴名列表: Optional[Iterable[str]] = None,
    ) -> List[轴配置]:
        self.准入_回零(当前)
        if 轴名列表 is None:
            return [self._配置.取轴(名) for 名 in self._配置.轴名列表]
        return self.校验轴名列表(list(轴名列表))

    # ------------------------------------------------------------------
    # 圆弧 / 螺旋
    # ------------------------------------------------------------------

    def 检查圆心圆弧(
        self,
        当前: 运动状态,
        轴名列表: Sequence[str],
        终点1: float, 终点2: float,
        圆心1: float, 圆心2: float,
        方向: int,
        速度: Optional[float],
        绝对: bool,
        当前位置: Optional[Sequence[float]] = None,
    ) -> tuple[List[轴配置], float]:
        """圆心定 2 点圆弧。

        - 必须正好 2 个轴（圆弧只在二维平面）
        - 方向 ∈ {0, 1}：0=逆时针, 1=顺时针
        - 绝对模式：终点必须落在两轴软限位内
        - 相对模式 + 提供当前位置：累加后做软限位
        """
        self.准入_运动指令(当前)
        if len(轴名列表) != 2:
            raise SafetyViolation(f"圆弧插补必须 2 个轴，收到 {list(轴名列表)}")
        cfgs = self.校验轴名列表(轴名列表)
        self.校验圆弧方向(方向)

        if 绝对:
            self.校验多轴软限位(轴名列表, [终点1, 终点2])
        elif 当前位置 is not None:
            self.校验长度匹配(轴名列表, 当前位置, "当前位置列表")
            self.校验相对位移(轴名列表[0], float(当前位置[0]), 终点1)
            self.校验相对位移(轴名列表[1], float(当前位置[1]), 终点2)

        return cfgs, self.归一化多轴速度(轴名列表, 速度)

    def 检查三点圆弧(
        self,
        当前: 运动状态,
        轴名列表: Sequence[str],
        中点1: float, 中点2: float,
        终点1: float, 终点2: float,
        速度: Optional[float],
        绝对: bool,
        当前位置: Optional[Sequence[float]] = None,
    ) -> tuple[List[轴配置], float]:
        """三点定圆弧。中间点和终点都会被经过，两者都做软限位检查。"""
        self.准入_运动指令(当前)
        if len(轴名列表) != 2:
            raise SafetyViolation(f"圆弧插补必须 2 个轴，收到 {list(轴名列表)}")
        cfgs = self.校验轴名列表(轴名列表)

        if 绝对:
            self.校验多轴软限位(轴名列表, [中点1, 中点2])
            self.校验多轴软限位(轴名列表, [终点1, 终点2])
        elif 当前位置 is not None:
            self.校验长度匹配(轴名列表, 当前位置, "当前位置列表")
            self.校验相对位移(轴名列表[0], float(当前位置[0]), 中点1)
            self.校验相对位移(轴名列表[1], float(当前位置[1]), 中点2)
            self.校验相对位移(轴名列表[0], float(当前位置[0]), 终点1)
            self.校验相对位移(轴名列表[1], float(当前位置[1]), 终点2)

        return cfgs, self.归一化多轴速度(轴名列表, 速度)

    def 检查螺旋(
        self,
        当前: 运动状态,
        轴名列表: Sequence[str],
        圆心1: float, 圆心2: float,
        圈数: int,
        螺距: float,
        第三轴距离: float,
        第四轴距离: float,
        速度: Optional[float],
        当前位置: Optional[Sequence[float]] = None,
    ) -> tuple[List[轴配置], float]:
        """螺旋插补：3 轴或 4 轴，相对运动（圆心相对起始点）。

        - 圈数 ≥ 1
        - 螺距 ≠ 0（否则退化为圆弧）
        - 当前位置提供时，累加距离做软限位（仅第 3/4 轴有意义；圆弧平面在工作区内由调用方保证）
        """
        self.准入_运动指令(当前)
        n = len(轴名列表)
        if n not in (3, 4):
            raise SafetyViolation(f"螺旋插补需要 3 或 4 个轴，收到 {n}")
        cfgs = self.校验轴名列表(轴名列表)
        if 圈数 < 1:
            raise SafetyViolation(f"螺旋圈数必须 ≥ 1，收到 {圈数}")
        if 螺距 == 0:
            raise SafetyViolation("螺旋螺距不能为 0（请改用圆弧插补）")

        # 第三 / 第四轴的累加位移做软限位检查
        if 当前位置 is not None and len(当前位置) >= n:
            self.校验相对位移(轴名列表[2], float(当前位置[2]), 第三轴距离)
            if n == 4:
                self.校验相对位移(轴名列表[3], float(当前位置[3]), 第四轴距离)

        return cfgs, self.归一化多轴速度(轴名列表, 速度)

    def 校验圆弧方向(self, 方向: int) -> int:
        if 方向 not in (0, 1):
            raise SafetyViolation(f"非法圆弧方向: {方向}（应为 0=逆时针 或 1=顺时针）")
        return 方向

    # ------------------------------------------------------------------
    # 连续轨迹（合并）
    # ------------------------------------------------------------------

    def 检查合并(self, 当前: 运动状态, 轴名: str) -> 轴配置:
        """开/关 MERGE 仅在 IDLE 或 MOVING 状态下允许。"""
        self.准入_运动指令(当前)
        return self.校验轴名(轴名)

    # ------------------------------------------------------------------
    # 进给倍率校验
    # ------------------------------------------------------------------

    def 归一化进给倍率(self, 倍率: float) -> float:
        最小 = self._配置.安全.最小进给倍率
        最大 = self._配置.安全.最大进给倍率
        if 倍率 < 最小 or 倍率 > 最大:
            raise SafetyViolation(
                f"进给倍率 {倍率} 超出范围 [{最小}, {最大}]"
            )
        return float(倍率)
