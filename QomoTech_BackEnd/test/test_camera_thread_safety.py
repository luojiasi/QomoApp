"""验证 asyncio.to_thread vs _在线程执行 的线程调度差异。

不依赖真实硬件，用模拟的非线程安全资源类验证：
  - asyncio.to_thread：默认线程池可调度到不同线程
  - _在线程执行：专用单线程执行器始终使用同一线程
"""

import asyncio
import threading
from concurrent.futures import ThreadPoolExecutor


class 模拟非线程安全DLL:
    """模拟一个内部有状态但没有锁的硬件 DLL。"""

    def __init__(self):
        self._调用线程: list[int] = []      # 记录每次调用的线程 id
        self._状态 = 0                      # 模拟内部状态

    def 操作(self, value: int) -> str:
        tid = threading.get_ident()
        self._调用线程.append(tid)

        # 模拟非线程安全的读-改-写：如果有两个线程同时操作，可能看到不一致的状态
        prev = self._状态
        # 用短暂的 sleep 放大竞态窗口
        import time
        time.sleep(0.01)
        self._状态 = prev + value
        return f"线程#{tid}: {prev} + {value} = {self._状态}"

    @property
    def 被不同线程调用过(self) -> bool:
        return len(set(self._调用线程)) > 1

    @property
    def 唯一调用线程数(self) -> int:
        return len(set(self._调用线程))


async def test_asyncio_to_thread():
    """测试 asyncio.to_thread（默认线程池）的线程行为。"""
    print("\n=== test_asyncio_to_thread: 默认线程池 ===")
    dll = 模拟非线程安全DLL()

    # 连续 10 次调用 asyncio.to_thread
    for i in range(10):
        result = await asyncio.to_thread(dll.操作, 1)
        print(f"  第{i+1:2d}次: {result}")

    unique = dll.唯一调用线程数
    print(f"  结果: 被 {unique} 个不同线程执行过")
    print(f"  状态终值: {dll._状态} (期望 10)")
    return dll


async def test_在线程执行():
    """测试专用单线程执行器（_在线程执行）的线程行为。"""
    print("\n=== test_在线程执行: 专用单线程执行器 ===")
    dll = 模拟非线程安全DLL()
    executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="Test-IO")

    for i in range(10):
        loop = asyncio.get_running_loop()
        result = await loop.run_in_executor(executor, dll.操作, 1)
        print(f"  第{i+1:2d}次: {result}")

    executor.shutdown(wait=True)
    unique = dll.唯一调用线程数
    print(f"  结果: 被 {unique} 个不同线程执行过")
    print(f"  状态终值: {dll._状态} (期望 10)")
    return dll


async def test_asyncio_to_thread_并发():
    """测试 asyncio.to_thread 并发调用时的竞态。"""
    print("\n=== test_asyncio_to_thread_并发: 默认线程池并发 ===")
    dll = 模拟非线程安全DLL()

    # 同时发起 10 个调用 —— 模拟推流取帧 + HTTP 取帧并发
    tasks = [asyncio.to_thread(dll.操作, 1) for _ in range(10)]
    results = await asyncio.gather(*tasks)
    for r in results:
        print(f"  {r}")

    unique = dll.唯一调用线程数
    print(f"  结果: 被 {unique} 个不同线程执行过")
    print(f"  状态终值: {dll._状态} (期望 10，但竞态下可能 < 10)")


async def test_在线程执行_并发():
    """测试专用单线程执行器并发调用时的行为。"""
    print("\n=== test_在线程执行_并发: 专用单线程执行器并发 ===")
    dll = 模拟非线程安全DLL()
    executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="Test-IO")

    tasks = []
    for _ in range(10):
        loop = asyncio.get_running_loop()
        tasks.append(loop.run_in_executor(executor, dll.操作, 1))
    results = await asyncio.gather(*tasks)
    for r in results:
        print(f"  {r}")

    executor.shutdown(wait=True)
    unique = dll.唯一调用线程数
    print(f"  结果: 被 {unique} 个不同线程执行过")
    print(f"  状态终值: {dll._状态} (期望 10，单线程保证)")


async def main():
    print(f"Python 默认线程池 worker 数: os.cpu_count() + 4 通常 >= 12")
    print(f"主线程 id: {threading.get_ident()}")

    # 1. 顺序调用对比
    dll1 = await test_asyncio_to_thread()
    dll2 = await test_在线程执行()

    print(f"\n--- 顺序调用结论 ---")
    if dll1.被不同线程调用过:
        print(f"  ❌ asyncio.to_thread  连续10次被 {dll1.唯一调用线程数} 个不同线程执行 → 存在调度风险")
    else:
        print(f"  ✅ asyncio.to_thread  连续10次同线程（偶然，不保证）")

    if dll2.被不同线程调用过:
        print(f"  ❌ _在线程执行        被多个线程执行 → 有问题！")
    else:
        print(f"  ✅ _在线程执行        始终同一线程 → 安全")

    # 2. 并发调用对比
    await test_asyncio_to_thread_并发()
    await test_在线程执行_并发()


if __name__ == "__main__":
    asyncio.run(main())
