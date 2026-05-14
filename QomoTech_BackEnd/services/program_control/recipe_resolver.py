"""配方解析器 —— 从配方数据中层级查找子配方。

提取自 ``core/startPragram.py``，消除三个巨型函数中重复的配方查找链。
"""

from __future__ import annotations

from typing import Any


def 在配方中查找ID的配方(配方数据: Any, id: Any) -> dict[str, Any] | None:
    """在 配方数据 中递归查找具有 ``id == id`` 的 dict。"""
    if 配方数据 is None:
        return None

    def _ids_equal(a: Any, b: Any) -> bool:
        if a is None or b is None:
            return a == b
        return str(a) == str(b)

    if isinstance(配方数据, (list, tuple)):
        for item in 配方数据:
            if isinstance(item, dict) and _ids_equal(item.get("id"), id):
                return item
            查找结果 = 在配方中查找ID的配方(item, id)
            if 查找结果 is not None:
                return 查找结果
        return None

    if isinstance(配方数据, dict):
        if _ids_equal(配方数据.get("id"), id):
            return 配方数据
        for value in 配方数据.values():
            查找结果 = 在配方中查找ID的配方(value, id)
            if 查找结果 is not None:
                return 查找结果
        return None

    return None


class RecipeResolver:
    """从完整配方 payload 中按层级解析各子配方。

    用法::

        resolver = RecipeResolver(配方数据)
        主配方 = resolver.获取主配方()
        扫黑配方 = resolver.获取扫黑配方(主配方)
        工作配方 = resolver.获取工作配方(主配方)
        激光配方 = resolver.获取激光配方(工作配方, "laserPowerRecipeId")
        ...
    """

    def __init__(self, 配方数据: dict[str, Any]) -> None:
        self._数据 = 配方数据

    # ------------------------------------------------------------------
    # 顶层配方
    # ------------------------------------------------------------------

    def 获取主配方(self) -> dict[str, Any]:
        return self._数据.get("selectedMainRecipe") or {}

    # ------------------------------------------------------------------
    # 二级配方（依赖主配方 id）
    # ------------------------------------------------------------------

    def 获取扫黑配方(self, 主配方: dict[str, Any] | None = None) -> dict[str, Any] | None:
        if 主配方 is None:
            主配方 = self.获取主配方()
        return 在配方中查找ID的配方(
            self._数据.get("selectedBlackeningRecipe"),
            主配方.get("blackeningRecipeId"),
        )

    def 获取工作配方(self, 主配方: dict[str, Any] | None = None) -> dict[str, Any] | None:
        if 主配方 is None:
            主配方 = self.获取主配方()
        return 在配方中查找ID的配方(
            self._数据.get("selectedMachiningRecipe"),
            主配方.get("machiningRecipeId"),
        )

    # ------------------------------------------------------------------
    # 三级配方（激光 / 水平 / 垂直公式）
    # ------------------------------------------------------------------

    def 获取激光配方(self, 父配方: dict[str, Any], key: str = "laserPowerRecipeId") -> dict[str, Any] | None:
        return 在配方中查找ID的配方(
            self._数据.get("selectedLaserRecipe"),
            父配方.get(key),
        )

    def 获取水平配方(self, 父配方: dict[str, Any]) -> dict[str, Any] | None:
        return 在配方中查找ID的配方(
            self._数据.get("selectedHorizontal"),
            父配方.get("horizontalFormulaId"),
        )

    def 获取垂直配方(self, 父配方: dict[str, Any]) -> dict[str, Any] | None:
        return 在配方中查找ID的配方(
            self._数据.get("selectedVertical"),
            父配方.get("verticalFormulaId"),
        )

    # ------------------------------------------------------------------
    # 一次解析全部所需配方（返回一个打包结果，减少重复查找）
    # ------------------------------------------------------------------

    def 解析全部(self) -> ProgramRecipeSet | None:
        """一次性解析主配方 → 扫黑/工作 → 激光/水平/垂直，失败返回 None。"""
        主配方 = self.获取主配方()
        if not 主配方:
            return None

        扫黑配方 = self.获取扫黑配方(主配方)
        工作配方 = self.获取工作配方(主配方)
        if 扫黑配方 is None or 工作配方 is None:
            return None

        扫黑激光 = self.获取激光配方(扫黑配方)
        工作激光 = self.获取激光配方(工作配方)
        水平配方 = self.获取水平配方(工作配方)
        垂直配方 = self.获取垂直配方(工作配方)

        if any(x is None for x in (扫黑激光, 工作激光, 水平配方, 垂直配方)):
            return None

        return ProgramRecipeSet(
            主配方=主配方,
            扫黑配方=扫黑配方,
            工作配方=工作配方,
            扫黑激光配方=扫黑激光,  # type: ignore[arg-type]
            工作激光配方=工作激光,  # type: ignore[arg-type]
            水平配方=水平配方,  # type: ignore[arg-type]
            垂直配方=垂直配方,  # type: ignore[arg-type]
        )


class ProgramRecipeSet:
    """一次解析后的全部配方集合。"""

    __slots__ = (
        "主配方", "扫黑配方", "工作配方",
        "扫黑激光配方", "工作激光配方",
        "水平配方", "垂直配方",
    )

    def __init__(
        self,
        *,
        主配方: dict[str, Any],
        扫黑配方: dict[str, Any],
        工作配方: dict[str, Any],
        扫黑激光配方: dict[str, Any],
        工作激光配方: dict[str, Any],
        水平配方: dict[str, Any],
        垂直配方: dict[str, Any],
    ) -> None:
        self.主配方 = 主配方
        self.扫黑配方 = 扫黑配方
        self.工作配方 = 工作配方
        self.扫黑激光配方 = 扫黑激光配方
        self.工作激光配方 = 工作激光配方
        self.水平配方 = 水平配方
        self.垂直配方 = 垂直配方

    @property
    def 是否开启扫黑(self) -> bool:
        return bool(self.扫黑配方.get("enabled"))

    @property
    def 扫黑上台高度(self) -> float:
        return float(self.扫黑配方.get("jiaojubuchang")) / 1000

    @property
    def 扫黑功率(self) -> Any:
        return self.扫黑激光配方.get("laserPower")

    @property
    def 扫黑频率(self) -> Any:
        return self.扫黑激光配方.get("laserFrequency")

    @property
    def 扫黑电流(self) -> Any:
        return self.扫黑激光配方.get("laserCurrent")

    @property
    def 工作功率(self) -> Any:
        return self.工作激光配方.get("laserPower")

    @property
    def 工作频率(self) -> Any:
        return self.工作激光配方.get("laserFrequency")

    @property
    def 工作电流(self) -> Any:
        return self.工作激光配方.get("laserCurrent")

    @property
    def 垂直公式(self) -> dict[str, Any]:
        return self.垂直配方 or {}

    @property
    def 水平公式(self) -> dict[str, Any]:
        return self.水平配方 or {}

    def 取水平公式子项(self, key: str) -> dict[str, Any]:
        return self.水平公式.get(key) or {}

    def 取垂直公式子项(self, key: str) -> dict[str, Any]:
        return self.垂直公式.get(key) or {}
