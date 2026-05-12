"""QomoTech 后端 —— 应用入口。

启动顺序：
  1. 解析资源路径（处理 PyInstaller _MEIPASS）
  2. 安装全局异常钩子（sys.excepthook + threading.excepthook）
  3. 加载配置
  4. 初始化日志系统
  5. 启动应用逻辑

用法：
    python main.py                  # 开发模式
    QomoTech_BackEnd.exe            # PyInstaller 打包后
"""
import sys

# ---------------------------------------------------------------------------
# 第一步 —— 解析路径（必须在任何本地导入之前完成）
# ---------------------------------------------------------------------------
from utils.path_utils import 路径工具
_应用根目录 = 路径工具.注册应用路径()

# ---------------------------------------------------------------------------
# 第二步 —— 安装全局异常钩子（必须在任何其他逻辑之前）
# ---------------------------------------------------------------------------
from utils.global_exceptions import 安装 as _安装全局异常处理
_安装全局异常处理()


# ---------------------------------------------------------------------------
# 第三、四步 —— 加载配置，初始化日志
# ---------------------------------------------------------------------------
from configs.app_config import 应用配置实例
def _启动():
    """加载配置并初始化日志系统。"""
    from utils.logger import 初始化 as 日志初始化

    日志初始化(
        日志目录=应用配置实例.日志配置.日志目录,
        日志配置=应用配置实例.日志配置.日志初始化字典(),
    )

    # 全量异常追踪（sys.settrace）仅在开发模式开启。
    # 打包后 PYZ 内 stdlib 也是相对路径，settrace 无法精准区分用户代码，会产生大量噪声日志。
    # 生产环境依赖 sys.excepthook（未捕获异常兜底）已足够。
    if not getattr(sys, "frozen", False):
        from utils.global_exceptions import 启用异常追踪
        启用异常追踪()


# ---------------------------------------------------------------------------
# 第五步 —— 应用入口
# ---------------------------------------------------------------------------
# .\venv\Scripts\pyinstaller.exe main.spec --noconfirm
def 主函数():
    """应用入口 —— 由顶层 try/except 保护调用。"""
    from utils.logger import 获取日志记录器
    日志 = 获取日志记录器("主进程")
    日志.info("QomoTech 后端启动中...")
    日志.info(f"应用根目录: {_应用根目录}")

    import uvicorn
    from core.app import app
    日志.info('获取服务器配置中...')
    host = 应用配置实例.服务配置.主机地址
    port = 应用配置实例.服务配置.端口号
    调试模式是否打开 = bool(应用配置实例.服务配置.调试模式) and not getattr(sys, "frozen", False)
    
    uvicorn.run(app if not 调试模式是否打开 else "core.app:app", host=host, port=port, reload=调试模式是否打开)


# ---------------------------------------------------------------------------
# 最终安全网
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    try:
        _启动()
        主函数()
    except KeyboardInterrupt:
        pass
    except Exception:
        import traceback
        try:
            print(traceback.format_exc(), file=sys.stderr)
        except Exception:
            pass
        sys.exit(1)
    finally:
        from utils.logger import 停止 as _停止日志
        _停止日志()
