from __future__ import annotations
import re
import threading
from pathlib import Path
from pydantic import BaseModel

class Product4PCenterRotation(BaseModel):
    Xoffset: float = 0.0
    Yoffset: float = 0.0
    Zoffset: float = 0.0

# 当前代码文件的绝对路径（配置存在这个文件里！）
_CONFIG_FILE_PATH = Path(__file__).resolve()
# 线程锁：保证多线程写文件时只有一个线程操作
_WRITE_LOCK = threading.Lock()
# 配置块的开始/结束标记（注释格式，用于定位配置）
_DATA_BLOCK_START = "# >>> PRODUCT4P_CENTER_ROTATION >>>"
_DATA_BLOCK_END = "# <<< PRODUCT4P_CENTER_ROTATION <<<"
_DATA_BLOCK_PATTERN = re.compile(
    rf"(?ms)^{re.escape(_DATA_BLOCK_START)}\s*\r?\n.*?^\s*{re.escape(_DATA_BLOCK_END)}\s*$"
)
# 正则表达式：匹配配置行的 X/Y/Z 偏移量数值
_DATA_LINE_PATTERN = re.compile(r"Xoffset=(?P<x>-?\d+(?:\.\d+)?),\s*Yoffset=(?P<y>-?\d+(?:\.\d+)?),\s*Zoffset=(?P<z>-?\d+(?:\.\d+)?)")

# 私有函数 仅内部调用
def 读取存储的4P旋转中心补偿值() -> Product4PCenterRotation:
    try:
        # 读取当前代码文件的所有内容
        content = _CONFIG_FILE_PATH.read_text(encoding="utf-8")
    except Exception:
        # 读取出错（如文件不存在），返回默认配置（全0）
        return Product4PCenterRotation()
    # 用正则匹配配置行
    match = _DATA_LINE_PATTERN.search(content)
    # 没匹配到配置，返回默认配置
    if not match: return Product4PCenterRotation()
    # 匹配成功，提取数值并返回模型实例
    return Product4PCenterRotation(Xoffset=float(match.group("x")),Yoffset=float(match.group("y")),Zoffset=float(match.group("z")),)

# 模块被导入时，自动执行加载函数，初始化全局配置，后续所有读取操作，都用这个全局变量。
product4p_center_rotation = 读取存储的4P旋转中心补偿值()

# 返回全局配置的【拷贝】，而不是原对象
def 获取4P旋转中心的补偿值() -> Product4PCenterRotation:
    return Product4PCenterRotation(**product4p_center_rotation.model_dump())

# 私有函数，把偏移量格式化成文件中存储的配置块
def 渲染配置文本(rotation: Product4PCenterRotation) -> str:
    return "\n".join(
        [
            _DATA_BLOCK_START,
            (
                "product4p_center_rotation = Product4PCenterRotation("
                f"Xoffset={rotation.Xoffset:.3f}, "
                f"Yoffset={rotation.Yoffset:.3f}, "
                f"Zoffset={rotation.Zoffset:.3f}"
                ")"
            ),
            _DATA_BLOCK_END,
        ]
    )


def 保存4P旋转中心的补偿值(payload: Product4PCenterRotation) -> Product4PCenterRotation:
    标准化补偿值参数 = Product4PCenterRotation(Xoffset=round(float(payload.Xoffset), 4),Yoffset=round(float(payload.Yoffset), 4),Zoffset=round(float(payload.Zoffset), 4),)
    with _WRITE_LOCK:
        # 读取原文件内容
        原文件内容 = _CONFIG_FILE_PATH.read_text(encoding="utf-8")
        # 生成新的配置块
        新的配置快 = 渲染配置文本(标准化补偿值参数)
        # 判断：文件中是否已有配置块（仅匹配“完整注释行”的块边界，避免误匹配变量定义行）
        if _DATA_BLOCK_PATTERN.search(原文件内容):
            # 已有配置块：正则替换（非贪婪匹配，替换整个配置块）
            更新内容 = _DATA_BLOCK_PATTERN.sub(
                新的配置快,
                原文件内容,
                count=1,
            )
        else:
            # 无配置块：追加到文件末尾
            更新内容 = f"{原文件内容.rstrip()}\n\n{新的配置快}\n"
        # 把更新后的内容写回文件
        _CONFIG_FILE_PATH.write_text(更新内容, encoding="utf-8")
        # 更新全局变量
        global product4p_center_rotation
        product4p_center_rotation = 标准化补偿值参数
    # 返回新配置（拷贝）
    return 获取4P旋转中心的补偿值()


# >>> PRODUCT4P_CENTER_ROTATION >>>
product4p_center_rotation = Product4PCenterRotation(Xoffset=0.000, Yoffset=0.000, Zoffset=0.000)
# <<< PRODUCT4P_CENTER_ROTATION <<<