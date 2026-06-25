"""安全控制器 —— 运动指令准入闸。

所有运动 API 在调用 ZMC 适配器之前，必须先通过本类的 检查 方法。违规时
抛 SafetyViolation —— 路由层（routers/motion_http.py）将其翻译为 HTTP 400。

职责拆分：
  - 静态校验：轴名是否合法、列表长度是否一致、JOG 方向是否 ±1
  - 速度归一：用户传 None 或越界值时 clamp 到 axis.speed（当前配置最大速度）
  - 状态准入：当前 运动状态 是否允许下发指令
                   IDLE/MOVING/HOMING ✅ 可下发新运动指令
                   PAUSED             ❌ 必须先 继续 / 停止
                   ESTOP/ALARM        ❌ 必须先 复位
                   DISCONNECTED       ❌ 必须先 连接
  - 复合检查：把上述若干检查打包成"一次完成"的 检查_xxx 方法

设计取舍：
  本类无状态，所有 检查 方法都把"当前运动状态"作为入参传入。这样：
    1. 单元测试无需 mock 状态机；
    2. service 编排层在指令下发前就拿到状态快照，避免双向依赖。

字段缺失时的处理：
  当前 configs/motion_config.py 不含 软限位 / 进给倍率范围 / 是否要求先回零
  等字段。本类在对应位置已留好 hook（以 `# TODO(soft_limit)` 标记），后续在
  motion_config 补完字段时直接在此处启用相应检查即可。
"""
from __future__ import annotations

from typing import Iterable, List, Optional, Sequence, Set

from configs.motion_config import MotionAxisConfig, MotionConfig
from services.motion_control.config_loader import 加载运动配置
from services.motion_control.motion_models import 运动状态


class SafetyViolation(Exception):
    """运动指令未通过安全检查。

    路由层（motion_http.py）把此异常翻译为 HTTP 400 BAD_REQUEST。
    """


# ----------------------------------------------------------------------
# 状态准入集合
# ----------------------------------------------------------------------

# 允许下发"新运动指令"的状态
_可运动状态: Set[运动状态] = {运动状态.IDLE, 运动状态.MOVING, 运动状态.HOMING}

# 允许下发"软停止 / 急停 / 复位"等控制指令的状态（比运动指令更宽松）
_可停止状态: Set[运动状态] = {
    运动状态.IDLE, 运动状态.MOVING, 运动状态.HOMING,
    运动状态.PAUSED, 运动状态.ESTOP, 运动状态.ALARM,
}


class 安全控制器:
    """无状态校验器 —— 所有 检查 方法都把"当前 运动状态"作为入参。"""

    def __init__(self, 配置: MotionConfig | None = None) -> None:
        # 允许构造时不传，默认从 config_loader 读全局单例（生产路径）；
        # 单测可以注入自定义 MotionConfig 验证软限位 / 速度上限等行为。
        self._配置: MotionConfig = 配置 if 配置 is not None else 加载运动配置()

    # ------------------------------------------------------------------
    # 静态校验
    # ------------------------------------------------------------------

    def 校验轴名(self, 轴名: str) -> MotionAxisConfig:
        """轴名是否在 motion_config.axes 中；返回对应轴配置。"""
        if 轴名 not in self._配置.axes:
            raise SafetyViolation(f"未配置的轴 {轴名!r}，可选: {list(self._配置.axes.keys())}")
        return self._配置.axes[轴名]

    def 校验轴名列表(self, 轴名列表: Sequence[str]) -> List[MotionAxisConfig]:
        """批量校验：非空 + 不重复 + 全部合法。"""
        if not 轴名列表:
            raise SafetyViolation("轴列表为空")
        if len(set(轴名列表)) != len(轴名列表):
            raise SafetyViolation(f"轴列表存在重复: {list(轴名列表)}")
        return [self.校验轴名(名) for 名 in 轴名列表]

    def 校验长度匹配(
        self,
        轴名列表: Sequence[str],
        数值列表: Sequence[float],
        标签: str = "数值列表",
    ) -> None:
        """多轴指令的列表长度一致性校验。"""
        if len(轴名列表) != len(数值列表):
            raise SafetyViolation(
                f"{标签} 与轴列表长度不一致：{len(轴名列表)} vs {len(数值列表)}"
            )

    def 校验方向(self, 方向: int) -> int:
        if 方向 not in (-1, 1):
            raise SafetyViolation(f"非法 JOG 方向: {方向}（应为 +1 或 -1）")
        return 方向

    # ------------------------------------------------------------------
    # 软限位校验（hook —— 等 motion_config 补字段后启用）
    # ------------------------------------------------------------------

    def 校验软限位(self, 轴名: str, 目标位置: float) -> None:
        """轴目标位置必须落在 [软限位负, 软限位正] 区间内。

        # TODO(soft_limit): 当前 MotionAxisConfig 未配置 soft_limit_pos /
        # soft_limit_neg 字段，跳过；补字段后改为：
        #   cfg = self.校验轴名(轴名)
        #   if 目标位置 > cfg.soft_limit_pos: raise SafetyViolation(...)
        #   if 目标位置 < cfg.soft_limit_neg: raise SafetyViolation(...)
        """
        # 仅做轴名校验，软限位检查暂跳过
        self.校验轴名(轴名)

    def 校验多轴软限位(
        self, 轴名列表: Sequence[str], 目标位置列表: Sequence[float],
    ) -> None:
        for 名, 位置 in zip(轴名列表, 目标位置列表):
            self.校验软限位(名, 位置)

    def 校验相对位移(self, 轴名: str, 当前位置: float, 距离: float) -> None:
        """相对运动 = 当前位置 + 距离 后做软限位校验（hook 同上）。"""
        self.校验软限位(轴名, 当前位置 + 距离)

    # ------------------------------------------------------------------
    # 速度归一
    # ------------------------------------------------------------------

    def 归一化速度(self, 轴名: str, 速度: Optional[float]) -> float:
        """速度归一规则：

          None       → 用配置 axis.speed 兜底
          <= 0       → 抛 SafetyViolation（速度必须 > 0）
          1 ~ 100    → 百分比模式：axis.speed * 速度 / 100
          > axis.speed → clamp 到 axis.speed（视为最大速度上限）
        """
        cfg = self.校验轴名(轴名)
        if 速度 is None:
            return float(cfg.speed)
        if 速度 <= 0:
            raise SafetyViolation(f"轴 {轴名} 速度必须 > 0，收到 {速度}")
        if 1 <= 速度 <= 100:
            return max(1.0, float(cfg.speed) * float(速度) / 100.0)
        return min(float(速度), float(cfg.speed))

    def 归一化多轴速度(
        self, 轴名列表: Sequence[str], 速度: Optional[float],
    ) -> float:
        """多轴插补共享一个进给速度，按所有参与轴的 axis.speed 最低值 clamp。"""
        if not 轴名列表:
            raise SafetyViolation("轴列表为空")
        上限 = min(float(self.校验轴名(名).speed) for 名 in 轴名列表)
        if 速度 is None:
            return 上限
        if 速度 <= 0:
            raise SafetyViolation(f"插补速度必须 > 0，收到 {速度}")
        return min(float(速度), 上限)

    # ------------------------------------------------------------------
    # 进给倍率校验（hook —— 等 motion_config 补字段后启用）
    # ------------------------------------------------------------------

    def 归一化进给倍率(self, 倍率: float) -> float:
        """FEED_OVERRIDE 必须落在 [0, 200] 区间内（ZMC 物理上限）。

        # TODO(feed_override): MotionConfig 未配置 safety.max_feed_override /
        # min_feed_override 字段，先用硬编码区间；补字段后改为读配置。
        """
        最小, 最大 = 0.0, 200.0
        if 倍率 < 最小 or 倍率 > 最大:
            raise SafetyViolation(f"进给倍率 {倍率} 超出范围 [{最小}, {最大}]")
        return float(倍率)

    # ------------------------------------------------------------------
    # 状态准入
    # ------------------------------------------------------------------

    def 准入_运动指令(self, 当前: 运动状态) -> None:
        """通用：能否下发任何"运动开始"类型的指令（绝对运动 / 直线插补 / 圆弧 / ...）。"""
        if 当前 == 运动状态.DISCONNECTED:
            raise SafetyViolation("控制器未连接")
        if 当前 in (运动状态.ESTOP, 运动状态.ALARM):
            raise SafetyViolation(f"当前状态 {当前.value}，需先调用 复位 清除")
        if 当前 == 运动状态.PAUSED:
            raise SafetyViolation("当前已暂停，请先 继续 或 停止")
        if 当前 not in _可运动状态:
            raise SafetyViolation(f"当前状态 {当前.value} 不允许下发运动指令")

    def 准入_点动(self, 当前: 运动状态) -> None:
        """点动只允许在 IDLE / MOVING 下开始。MOVING 允许是因为多轴同时 jog。"""
        if 当前 == 运动状态.DISCONNECTED:
            raise SafetyViolation("控制器未连接")
        if 当前 in (运动状态.ESTOP, 运动状态.ALARM):
            raise SafetyViolation(f"当前状态 {当前.value}，需先调用 复位 清除")
        if 当前 not in (运动状态.IDLE, 运动状态.MOVING):
            raise SafetyViolation(f"点动只能从 IDLE/MOVING 开始，当前 {当前.value}")

    def 准入_回零(self, 当前: 运动状态) -> None:
        if 当前 == 运动状态.DISCONNECTED:
            raise SafetyViolation("控制器未连接")
        if 当前 in (运动状态.ESTOP, 运动状态.ALARM):
            raise SafetyViolation(f"当前状态 {当前.value}，需先调用 复位 清除")
        if 当前 != 运动状态.IDLE:
            raise SafetyViolation(f"回零只能从 IDLE 开始，当前 {当前.value}")

    def 准入_停止类(self, 当前: 运动状态) -> None:
        """停止 / 急停 / 复位 等控制指令；比"运动指令"宽松，PAUSED/ESTOP/ALARM 也允许。"""
        if 当前 == 运动状态.DISCONNECTED:
            raise SafetyViolation("控制器未连接")
        if 当前 not in _可停止状态:
            raise SafetyViolation(f"当前状态 {当前.value} 不允许该指令")

    def 准入_暂停(self, 当前: 运动状态) -> None:
        if 当前 == 运动状态.DISCONNECTED:
            raise SafetyViolation("控制器未连接")
        if 当前 != 运动状态.MOVING:
            raise SafetyViolation(f"暂停只能在 MOVING 触发，当前 {当前.value}")

    def 准入_继续(self, 当前: 运动状态) -> None:
        if 当前 == 运动状态.DISCONNECTED:
            raise SafetyViolation("控制器未连接")
        if 当前 != 运动状态.PAUSED:
            raise SafetyViolation(f"继续只能在 PAUSED 触发，当前 {当前.value}")

    # ------------------------------------------------------------------
    # 复合检查（一次性完成多项校验，供 service 调用）
    # ------------------------------------------------------------------

    def 检查单轴绝对(
        self,
        当前: 运动状态,
        轴名: str,
        位置: float,
        速度: Optional[float],
    ) -> tuple[MotionAxisConfig, float]:
        """绝对运动前置检查 → (轴配置, 归一化速度)。"""
        self.准入_运动指令(当前)
        cfg = self.校验轴名(轴名)
        self.校验软限位(轴名, 位置)
        return cfg, self.归一化速度(轴名, 速度)

    def 检查单轴相对(
        self,
        当前: 运动状态,
        轴名: str,
        距离: float,
        速度: Optional[float],
        当前位置: Optional[float] = None,
    ) -> tuple[MotionAxisConfig, float]:
        """相对运动前置检查 → (轴配置, 归一化速度)。

        若提供 当前位置（来自最新快照），会做累加后软限位校验；不提供则跳过。
        """
        self.准入_运动指令(当前)
        cfg = self.校验轴名(轴名)
        if 当前位置 is not None:
            self.校验相对位移(轴名, float(当前位置), float(距离))
        return cfg, self.归一化速度(轴名, 速度)

    def 检查直线插补(
        self,
        当前: 运动状态,
        轴名列表: Sequence[str],
        位置列表: Sequence[float],
        速度: Optional[float],
        相对: bool,
        当前位置: Optional[Sequence[float]] = None,
    ) -> tuple[List[MotionAxisConfig], float]:
        """多轴直线插补前置检查 → (轴配置列表, 归一化插补速度)。

        相对模式下若提供 当前位置，会做累加后软限位校验；不提供则跳过。
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
        self,
        当前: 运动状态,
        轴名: str,
        方向: int,
        速度: Optional[float],
    ) -> tuple[MotionAxisConfig, int, float]:
        """点动前置检查 → (轴配置, 归一化方向, 归一化速度)。"""
        self.准入_点动(当前)
        cfg = self.校验轴名(轴名)
        方向归一 = self.校验方向(方向)
        return cfg, 方向归一, self.归一化速度(轴名, 速度)

    def 检查回零(
        self,
        当前: 运动状态,
        轴名列表: Optional[Iterable[str]] = None,
    ) -> List[MotionAxisConfig]:
        """回零前置检查 → 轴配置列表（None 表示全轴）。

        # TODO(require_home): 后续在 motion_config.safety 加 require_home_before_run
        # 字段后，可在此扩展"未回零禁止运行"等策略。
        """
        self.准入_回零(当前)
        if 轴名列表 is None:
            return list(self._配置.axes.values())
        return self.校验轴名列表(list(轴名列表))

    def 检查合并(self, 当前: 运动状态, 轴名: str) -> MotionAxisConfig:
        """开 / 关连续轨迹合并（MERGE）前置检查 —— 仅 IDLE / MOVING 可调用。"""
        self.准入_运动指令(当前)
        return self.校验轴名(轴名)
