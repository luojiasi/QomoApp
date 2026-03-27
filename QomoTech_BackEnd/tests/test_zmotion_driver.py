import os
import sys
import time
import unittest
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from config.motion_config import motion_config
from drivers.zmotion_driver import ZMotionDriver


class TestZMotionDriverContinuousInterpolation(unittest.TestCase):
    def test_continuous_interpolation_move_with_real_controller(self):
        controller_ip = os.getenv("ZMOTION_TEST_IP") or os.getenv("MOTION_CONTROLLER_IP") or motion_config.controller_ip
        driver = ZMotionDriver(controller_ip)

        connected = driver.connect(controller_ip)
        self.assertTrue(connected, msg=f"控制器连接失败: ip={controller_ip}, err={driver.last_error}")
        self.assertEqual(driver.driver_mode, "zauxdll", msg=f"当前不是 DLL 真机模式: {driver.driver_mode}, err={driver.last_error}")

        try:
            # 读取当前 XY，采用“当前位置 -> 当前位置”的路径，避免测试导致设备实际位移
            status = driver.get_axes_status()
            x0 = float(0)
            y0 = float(0)
            x1 = float(10)
            y1 = float(10)
            x2 = float(10)
            y2 = float(-10)
            x3 = float(60)
            y3 = float(70)
            x4 = float(-190)
            y4 = float(-50)
            print('running')
            ok = driver.continuous_interpolation_move(
                axis_list=[0, 1],
                path_points=[
                    {"x": x0, "y": y0, "speed": 20.0},
                    {"x": x1, "y": y1, "speed": 80.0},
                    {"x": x2, "y": y2, "speed": 88.0},
                    {"x": x3, "y": y3, "speed": 20.0},
                    {"x": x4, "y": y4, "speed": 60.0},
                ],
                merge_enable=False,
                auto_corner_decel=False,
                wait_until_done=True,
                done_timeout_s=120.0,
                done_poll_interval_s=0.02,
            )
            print('runend')
            self.assertTrue(ok, msg=f"连续插补执行失败: err={driver.last_error}, code={driver.last_error_code}")

            # 连续插补下发后等待 6 秒，再执行全轴急停
            stopped = driver.emergency_stop_all_axes([0, 1])
            self.assertTrue(stopped, msg=f"全轴急停失败: err={driver.last_error}, code={driver.last_error_code}")

            status_after = driver.get_axes_status()
            print("=== 运动后轴状态(X/Y) ===")
            print(f"X轴: {status_after.get('0')}")
            print(f"Y轴: {status_after.get('1')}")
            self.assertEqual(int(status_after.get("0", {}).get("idle", 0)), 1, msg="X轴急停后仍非空闲")
            self.assertEqual(int(status_after.get("1", {}).get("idle", 0)), 1, msg="Y轴急停后仍非空闲")
        finally:
            driver.disconnect()


if __name__ == "__main__":
    unittest.main()
