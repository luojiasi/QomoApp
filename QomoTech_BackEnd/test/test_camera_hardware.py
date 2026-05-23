"""真硬件相机线程安全验证。

在真实 CGDEVSDK.dll 上对比 asyncio.to_thread 和 _在线程执行的线程行为。

⚠️  test_asyncio_to_thread_快速取帧 可能导致进程崩溃（access violation），
    这正是我们要验证的问题。进程崩溃后重新运行即可，不会损坏硬件。
"""

import asyncio
import threading
import time
from concurrent.futures import ThreadPoolExecutor

from libs.cameradll.CGimagetechPython import CGImageTechCamera
from utils.logger import 获取日志记录器

日志 = 获取日志记录器("相机线程测试")

TEST_FRAME_COUNT = 20
TEST_TIMEOUT_MS = 2000


def _在线程中运行(cam, func_name, *args):
    """在临时单线程执行器中运行一次 DLL 调用（用于对照实验）。"""
    executor = ThreadPoolExecutor(max_workers=1)
    loop = asyncio.get_running_loop()
    return loop.run_in_executor(executor, getattr(cam, func_name), *args)


async def 初始化相机() -> CGImageTechCamera:
    """初始化 SDK 并打开相机，返回就绪的 camera 实例。"""
    cam = CGImageTechCamera()

    status = cam.initialize()
    if status != 0:
        raise RuntimeError(f"SDK 初始化失败: {status}")
    日志.info("SDK 初始化 OK")

    h = cam.open_camera(0)
    if h is None:
        raise RuntimeError("打开相机失败，请确认相机已连接")
    日志.info("相机打开 OK")

    status = cam.init_camera_for_getmode()
    if status != 0:
        raise RuntimeError(f"DeviceInit 失败: {status}")

    status = cam.start_stream()
    if status != 0:
        raise RuntimeError(f"启动推流失败: {status}")
    日志.info("推流启动 OK")

    return cam


def 同步取帧并记录线程(cam: CGImageTechCamera, 线程记录: list[int]):
    """同步取一帧，记录执行线程 id。"""
    线程记录.append(threading.get_ident())
    return cam.capture_frame(TEST_TIMEOUT_MS, True)


# ====================================================================
# 测试 1：asyncio.to_thread 快速连续取帧（危险！可能崩溃）
# ====================================================================

async def test_asyncio_to_thread_快速取帧():
    """用默认线程池连续取帧，观察线程分配。

    ⚠️ 这是出厂崩溃的精确复现：WebSocket 推流循环中 asyncio.to_thread
       连续两次调用可能被调度到不同线程。
    """
    print("\n" + "=" * 60)
    print("⚠️  test_asyncio_to_thread_快速取帧")
    print("   用默认线程池连续取帧，观察是否触发崩溃")
    print("=" * 60)

    cam = await 初始化相机()
    线程记录: list[int] = []

    try:
        for i in range(TEST_FRAME_COUNT):
            img = await asyncio.to_thread(同步取帧并记录线程, cam, 线程记录)
            unique = len(set(线程记录))
            tid = 线程记录[-1]
            shape = img.shape if img is not None else "None"
            print(f"  [{i+1:2d}/{TEST_FRAME_COUNT}] 线程#{tid}  image={shape}  (累计 {unique} 个线程)")

            # 一旦发现线程切换就标记
            if unique > 1:
                print(f"\n  ⚠️  第 {i+1} 次调用切换到第 {unique} 个线程！")
                print(f"  这说明 asyncio.to_thread 的默认线程池在复用不同的 worker。")
                print(f"  如果此时崩溃，就是线程切换导致 DLL 内部状态损坏的证据。")
    finally:
        try:
            cam.stop_stream()
            cam.close_camera()
            cam.uninitialize_sdk()
        except Exception:
            pass

    唯一线程数 = len(set(线程记录))
    print(f"\n  结论: {TEST_FRAME_COUNT}次取帧被 {唯一线程数} 个不同线程执行")
    if 唯一线程数 > 1:
        print(f"  ❌ 默认线程池存在多线程调度，有崩溃风险")
    else:
        print(f"  ⚠️  本次未切换线程（小概率事件，不代表安全）")


# ====================================================================
# 测试 2：单线程执行器取帧（安全对照组）
# ====================================================================

async def test_在线程执行_快速取帧():
    """用专用单线程执行器连续取帧，验证始终同线程。"""
    print("\n" + "=" * 60)
    print("✅ test_在线程执行_快速取帧")
    print("   用专用单线程执行器取帧，验证始终同线程")
    print("=" * 60)

    cam = await 初始化相机()
    线程记录: list[int] = []
    executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="Test-Camera")
    loop = asyncio.get_running_loop()

    try:
        for i in range(TEST_FRAME_COUNT):
            img = await loop.run_in_executor(executor, 同步取帧并记录线程, cam, 线程记录)
            tid = 线程记录[-1]
            shape = img.shape if img is not None else "None"
            print(f"  [{i+1:2d}/{TEST_FRAME_COUNT}] 线程#{tid}  image={shape}")
    finally:
        executor.shutdown(wait=False)
        try:
            cam.stop_stream()
            cam.close_camera()
            cam.uninitialize_sdk()
        except Exception:
            pass

    唯一线程数 = len(set(线程记录))
    print(f"\n  结论: {TEST_FRAME_COUNT}次取帧被 {唯一线程数} 个不同线程执行")
    if 唯一线程数 == 1:
        print(f"  ✅ 始终同一线程，安全")
    else:
        print(f"  ❌ 单线程执行器出现了多线程？这不应该发生")


# ====================================================================
# 测试 3：默认线程池并发取帧（极危险，几乎必崩）
# ====================================================================

async def test_asyncio_to_thread_并发取帧():
    """并发发起多个取帧请求，观察多线程竞争。

    ⚠️⚠️  这是 ZMC 日志中只出现一次的并发崩溃场景：
          多个 asyncio.to_thread 同时打 DLL，极大概率崩溃。
          如果崩了不要惊讶 —— 这正是证据。
    """
    print("\n" + "=" * 60)
    print("⚠️⚠️  test_asyncio_to_thread_并发取帧（极危险）")
    print("     多个线程并发打同一个 device_handle")
    print("=" * 60)

    cam = await 初始化相机()
    线程记录: list[int] = []

    async def 取一帧(i):
        return await asyncio.to_thread(同步取帧并记录线程, cam, 线程记录)

    try:
        tasks = [取一帧(i) for i in range(5)]
        results = await asyncio.gather(*tasks)
        for i, img in enumerate(results):
            print(f"  [{i+1}/5] image={img.shape if img is not None else 'None'}")
    except Exception as exc:
        print(f"  ❌ 并发取帧异常（不意外）: {exc}")
    finally:
        try:
            cam.stop_stream()
            cam.close_camera()
            cam.uninitialize_sdk()
        except Exception:
            pass

    唯一线程数 = len(set(线程记录))
    print(f"\n  结论: 并发取帧被 {唯一线程数} 个不同线程执行")


# ====================================================================
# 主入口
# ====================================================================

async def main():
    print("相机线程安全验证")
    print(f"启动时间: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"主线程 id: {threading.get_ident()}")

    # 先跑安全对照组，确保相机和 SDK 工作正常
    await test_在线程执行_快速取帧()

    # 再跑危险组 —— 如果这里崩了，上面已经拿到基准数据
    # 跳过可注释掉下面两行
    await test_asyncio_to_thread_快速取帧()
    # await test_asyncio_to_thread_并发取帧()  # 极危险，按需取消注释

    print("\n" + "=" * 60)
    print("全部测试完成")

if __name__ == "__main__":
    asyncio.run(main())
