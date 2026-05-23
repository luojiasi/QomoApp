"""持续崩溃复现测试 v2 —— 修复了 stdout 缓冲问题。

用 asyncio.to_thread 持续取帧直至崩溃，对比 errlog 中的 pattern。
每帧刷新输出，方便实时观察。
"""

import asyncio
import os
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor

_backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

from libs.cameradll.CGimagetechPython import CGImageTechCamera

COUNTER = [0]
START_TIME = time.time()
CRASHED = False


def 取一帧(cam, 线程记录):
    COUNTER[0] += 1
    n = COUNTER[0]
    tid = threading.get_ident()
    线程记录.append(tid)
    img = cam.capture_frame(2000, True)
    if n % 50 == 0 or n <= 10:
        unique = len(set(线程记录))
        elapsed = time.time() - START_TIME
        mem = _内存MB()
        print(
            f"[{n:6d}] 帧={img.shape}  tid=#{tid}  "
            f"累计{unique}线程  运行{elapsed:.0f}s  内存{mem:.0f}MB",
            flush=True,
        )
    return img


def _内存MB():
    import psutil
    try:
        return psutil.Process().memory_info().rss / 1024 / 1024
    except Exception:
        return 0


async def concurrent_burst(cam, 线程记录):
    loop = asyncio.get_running_loop()
    n = 12  # 更多并发
    tasks = [loop.run_in_executor(None, 取一帧, cam, 线程记录) for _ in range(n)]
    await asyncio.gather(*tasks)


async def main():
    global START_TIME

    print("v2 持续崩溃复现测试 (强制刷新输出)", flush=True)
    print(
        "每5帧发起12路并发突袭, asyncio.to_thread 默认线程池", flush=True
    )
    print("=" * 50, flush=True)
    START_TIME = time.time()

    cam = CGImageTechCamera()
    if cam.initialize() != 0:
        raise RuntimeError("SDK 初始化失败")

    h = cam.open_camera(0)
    if h is None:
        raise RuntimeError("打开相机失败")

    if cam.init_camera_for_getmode() != 0:
        raise RuntimeError("DeviceInit 失败")

    if cam.start_stream() != 0:
        raise RuntimeError("启动推流失败")

    print("相机就绪", flush=True)

    线程记录 = []
    loop = asyncio.get_running_loop()

    try:
        while True:
            for _ in range(5):
                await loop.run_in_executor(None, 取一帧, cam, 线程记录)
                await asyncio.sleep(0.002)

            # 每5帧之后12路并发突袭
            await concurrent_burst(cam, 线程记录)
            # 强制回收
            await asyncio.sleep(0.001)

    except KeyboardInterrupt:
        print("\n手动中断", flush=True)
    except Exception as exc:
        global CRASHED
        CRASHED = True
        print(f"\n[CRASH] {type(exc).__name__}: {exc}", flush=True)
        import traceback
        traceback.print_exc()
    finally:
        try:
            cam.stop_stream()
            cam.close_camera()
            cam.uninitialize_sdk()
        except Exception:
            pass

    unique = len(set(线程记录))
    elapsed = time.time() - START_TIME
    print(
        f"\n共 {COUNTER[0]} 帧, {unique} 线程, {elapsed:.0f}s, "
        f"崩溃={'是' if CRASHED else '否'}",
        flush=True,
    )


if __name__ == "__main__":
    try:
        import psutil
    except ImportError:
        print("需要 psutil: pip install psutil", flush=True)
        sys.exit(1)
    asyncio.run(main())
