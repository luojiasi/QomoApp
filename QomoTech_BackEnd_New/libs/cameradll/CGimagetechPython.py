import sys
import ctypes
import platform
import os
import time

import cv2
import numpy as np


# ===== C 类型映射（来自手册第3章）=====
BYTE = ctypes.c_ubyte
UCHAR = ctypes.c_ubyte
USHORT = ctypes.c_ushort
BOOL = ctypes.c_int
INT = ctypes.c_int
UINT = ctypes.c_uint
DWORD = ctypes.c_uint32
FLOAT = ctypes.c_float
HANDLE = ctypes.c_void_p
LPVOID = ctypes.c_void_p
HWND = ctypes.c_void_p

HDEVICE = ctypes.c_void_p
PHDEVICE = ctypes.POINTER(HDEVICE)
DeviceStatus = ctypes.c_int

# DeviceStatus 常见错误码（手册 3.2）
STATUS_OK = 0
STATUS_TIME_OUT = -1000
STATUS_INVALIDATE_HANDLE = -9

# emOpenDeviceFlag（手册 3.2）
OF_BYPOSITION = 0x00
OF_BYUSBADDRESS = 0x01
OF_USERSERIALNUMBER = 0x02
OF_DEVELOPERSERIALNUMBER = 0x03
OF_FACTORYSERIALNUMBER = 0x04

# emDeviceISPDataType（手册 3.2）
DATA_ISP_RGB24 = 0x00
DATA_ISP_RGB32 = 0x01
DATA_ISP_MON8 = 0x02

# emDeviceFrameSpeed（手册 3.2）
HIGHEST_SPEED = 0x00
HIGH_SPEED = 0x01
LOW_SPEED = 0x02
LOWEST_SPEED = 0x03

# emMirrorDirection（手册 3.2）
MD_HORIZONTAL = 0x00
MD_VERTICAL = 0x01


class EnumDeviceParam(ctypes.Structure):
    _fields_ = [
        ("devIndex", UCHAR),  # OF_BYPOSITION
        ("usbAddress", UCHAR),  # OF_BYUSBADDRESS
        ("devSN", BYTE * 32),  # 用户序列号
        ("index", INT),  # 枚举序列 0-n
        ("lpDeviceDesc", ctypes.c_char * 256),  # 设备名（按文档描述，按字符串缓冲区处理）
        ("nDeviceDesc", INT),  # 名称长度
    ]


LPEnumDeviceParam = ctypes.POINTER(EnumDeviceParam)


class UionOpenDeviceParam(ctypes.Union):
    _fields_ = [
        ("devIndex", UCHAR),
        ("usbAddress", UCHAR),
        ("devSN", BYTE * 32),
    ]


class DeviceFrameInfo(ctypes.Structure):
    _fields_ = [
        ("uiMediaType", UINT),
        ("uiISPDataType", UINT),
        ("uBytes", UINT),
        ("uiWidth", UINT),
        ("uiHeight", UINT),
        ("bMonochrome", BOOL),
        ("bTriggered", BOOL),
    ]


# ReceiveFrameProc: void CALLBACK ReceiveFrameProc(LPVOID pDevice, BYTE* pImageBuffer, DeviceFrameInfo* pFrInfo, LPVOID lParam)
ReceiveFrameProc = ctypes.WINFUNCTYPE(None, LPVOID, ctypes.POINTER(BYTE), ctypes.POINTER(DeviceFrameInfo), LPVOID)


class CGImageTechCamera:
    def __init__(self, dll_path='CGDEVSDK.dll'):
        """初始化相机SDK封装类"""
        if platform.system() != "Windows":
            raise RuntimeError("CGDEVSDK.dll 仅支持 Windows")

        # 优先从当前脚本目录加载，避免 PATH 冲突
        base_dir = os.path.dirname(os.path.abspath(__file__))
        candidate = os.path.join(base_dir, dll_path)
        dll_to_load = candidate if os.path.exists(candidate) else dll_path
        try:
            self.dll = ctypes.WinDLL(dll_to_load)
        except OSError as e:
            # WinError 193：常见于 DLL 位数与 Python 位数不匹配（32/64 位）
            py_bits = ctypes.sizeof(ctypes.c_void_p) * 8
            raise OSError(
                f"加载 DLL 失败: {dll_to_load}\n"
                f"原始错误: {e}\n"
                f"当前 Python 位数: {py_bits} 位。\n"
                f"如果报 WinError 193，通常是 DLL 与 Python 位数不一致：\n"
                f"- 32位 DLL 需要 32位 Python\n"
                f"- 64位 DLL 需要 64位 Python\n"
                f"请确认厂商提供的 CGDEVSDK.dll 位数，或更换匹配的 Python/SDK。"
            ) from e
        self._define_functions()
        self.device_handle = None
        self.initialized = False
        self._streaming = False
        
    def _define_functions(self):
        """定义所有函数原型"""
        # DeviceGetSDKVersion: 读取 SDK 版本号（4个DWORD：主/次/修订/构建）
        self.DeviceGetSDKVersion = self.dll.DeviceGetSDKVersion
        # C原型: DeviceStatus DeviceGetSDKVersion(DWORD adwVersion[4])
        # Python侧传入 DWORD[4] 的指针，函数写回版本信息
        self.DeviceGetSDKVersion.argtypes = [ctypes.POINTER(DWORD * 4)]
        # 返回 DeviceStatus，0 表示成功，非0为错误码
        self.DeviceGetSDKVersion.restype = DeviceStatus
        
        # DeviceInitialSDK: 初始化整个 SDK（必须先调用）
        self.DeviceInitialSDK = self.dll.DeviceInitialSDK
        # C原型: DeviceStatus DeviceInitialSDK(HANDLE hHandle, BOOL bUsedStatus, BOOL bPNP)
        # hHandle: 事件窗口句柄；bUsedStatus: 是否启用占用标记；bPNP: 是否启用热插拔恢复
        self.DeviceInitialSDK.argtypes = [HANDLE, BOOL, BOOL]
        self.DeviceInitialSDK.restype = DeviceStatus
        
        # DeviceUnInitialSDK: 反初始化 SDK，释放全局资源（程序退出前调用）
        self.DeviceUnInitialSDK = self.dll.DeviceUnInitialSDK
        # C原型: DeviceStatus DeviceUnInitialSDK(void)
        self.DeviceUnInitialSDK.argtypes = []
        self.DeviceUnInitialSDK.restype = DeviceStatus

        # EnumDevice: 枚举设备（通常先传None拿数量，再传数组拿详情）
        self.EnumDevice = self.dll.EnumDevice
        # C原型: DeviceStatus EnumDevice(LPEnumDeviceParam pDeviceList, INT *piNums)
        # pDeviceList: 设备数组指针；piNums: 输入数组容量/输出实际数量
        self.EnumDevice.argtypes = [LPEnumDeviceParam, ctypes.POINTER(INT)]
        self.EnumDevice.restype = DeviceStatus

        # OpenDevice / OpenDeviceByIndex: 打开相机句柄（兼容不同SDK导出）
        self.OpenDevice = getattr(self.dll, "OpenDevice", None)
        if self.OpenDevice is not None:
            # C原型: DeviceStatus OpenDevice(UionOpenDeviceParam param, PHDEVICE pDevice, emOpenDeviceFlag flag)
            # param: 打开参数联合体；pDevice: 输出设备句柄；flag: 打开方式（按序号/USB地址/SN）
            self.OpenDevice.argtypes = [UionOpenDeviceParam, PHDEVICE, INT]
            self.OpenDevice.restype = DeviceStatus

        self.OpenDeviceByIndex = getattr(self.dll, "OpenDeviceByIndex", None)
        if self.OpenDeviceByIndex is not None:
            # C原型: DeviceStatus OpenDeviceByIndex(UCHAR index, PHDEVICE pDevice)
            # 按设备序号直接打开，常用于单相机快速接入
            self.OpenDeviceByIndex.argtypes = [UCHAR, PHDEVICE]
            self.OpenDeviceByIndex.restype = DeviceStatus

        # CloseDevice: 关闭设备句柄（注意先停流再关）
        self.CloseDevice = self.dll.CloseDevice
        # C原型: void CloseDevice(HDEVICE hDevice)
        self.CloseDevice.argtypes = [HDEVICE]
        self.CloseDevice.restype = None

        # DeviceRelease: 释放设备引用（与 DeviceAddReference 配对）
        self.DeviceRelease = getattr(self.dll, "DeviceRelease", None)
        if self.DeviceRelease is not None:
            # 常见原型: INT DeviceRelease(HDEVICE hDevice)
            self.DeviceRelease.argtypes = [HDEVICE]
            self.DeviceRelease.restype = INT

        # DeviceInit / DeviceUnInit: 初始化/反初始化单个相机设备
        self.DeviceInit = self.dll.DeviceInit
        # C原型: DeviceStatus DeviceInit(HDEVICE hDevice, HWND hWndDisplay, BOOL bGetMode, BOOL bAutoParam)
        # hWndDisplay=None 表示不走SDK内部绘制；bGetMode=True 表示用 DeviceGetImageBuffer* 拉流
        self.DeviceInit.argtypes = [HDEVICE, HWND, BOOL, BOOL]
        self.DeviceInit.restype = DeviceStatus

        self.DeviceInitEx = getattr(self.dll, "DeviceInitEx", None)
        if self.DeviceInitEx is not None:
            # C原型: DeviceStatus DeviceInitEx(HDEVICE hDevice, ReceiveFrameProc pFun, LPVOID lParam, HWND hWndDisplay, BOOL bAutoParam)
            # 该接口是回调模式，本脚本当前主流程用的是 GetMode，不依赖回调
            self.DeviceInitEx.argtypes = [HDEVICE, ReceiveFrameProc, LPVOID, HWND, BOOL]
            self.DeviceInitEx.restype = DeviceStatus

        self.DeviceUnInit = self.dll.DeviceUnInit
        # C原型: DeviceStatus DeviceUnInit(HDEVICE hDevice)
        # 必须在销毁显示与关闭设备前后按流程调用，避免资源泄漏
        self.DeviceUnInit.argtypes = [HDEVICE]
        self.DeviceUnInit.restype = DeviceStatus

        # DeviceStart / DeviceStop / IsReceivingData: 视频流状态控制
        self.DeviceStart = self.dll.DeviceStart
        # C原型: DeviceStatus DeviceStart(HDEVICE hDevice) -> 打开视频流
        self.DeviceStart.argtypes = [HDEVICE]
        self.DeviceStart.restype = DeviceStatus

        self.DeviceStop = self.dll.DeviceStop
        # C原型: DeviceStatus DeviceStop(HDEVICE hDevice) -> 停止视频流
        self.DeviceStop.argtypes = [HDEVICE]
        self.DeviceStop.restype = DeviceStatus

        self.IsReceivingData = self.dll.IsReceivingData
        # C原型: BOOL IsReceivingData(HDEVICE hDevice) -> TRUE表示流已开启
        self.IsReceivingData.argtypes = [HDEVICE]
        self.IsReceivingData.restype = BOOL

        # Get/ISP 设置：决定拉流模式与输出像素格式
        self.DeviceSetUsedGetMode = self.dll.DeviceSetUsedGetMode
        # C原型: DeviceStatus DeviceSetUsedGetMode(HDEVICE hDevice, BOOL bGetMode)
        # True 启用 DeviceGetImageBuffer* 方式取图
        self.DeviceSetUsedGetMode.argtypes = [HDEVICE, BOOL]
        self.DeviceSetUsedGetMode.restype = DeviceStatus

        self.DeviceSetISPDataType = self.dll.DeviceSetISPDataType
        # C原型: DeviceStatus DeviceSetISPDataType(HDEVICE hDevice, emDeviceISPDataType nType)
        # 常用 DATA_ISP_RGB24，便于直接转为 OpenCV 图像
        self.DeviceSetISPDataType.argtypes = [HDEVICE, INT]
        self.DeviceSetISPDataType.restype = DeviceStatus

        self.GetImageSize = self.dll.GetImageSize
        # C原型: DeviceStatus GetImageSize(HDEVICE hDevice, INT *piWidth, INT *piHeight)
        # 获取当前分辨率，用于申请接收缓冲区
        self.GetImageSize.argtypes = [HDEVICE, ctypes.POINTER(INT), ctypes.POINTER(INT)]
        self.GetImageSize.restype = DeviceStatus

        # DeviceGetImageBufferEx2: 取一帧已ISP处理后的图像到用户缓冲区（推荐）
        self.DeviceGetImageBufferEx2 = self.dll.DeviceGetImageBufferEx2
        # C原型: DeviceStatus DeviceGetImageBufferEx2(HDEVICE hDevice, BYTE *pImageData, UINT wTimes, DeviceFrameInfo *psFrInfo)
        # pImageData: 用户预分配缓冲区；wTimes: 超时毫秒；psFrInfo: 输出帧信息
        self.DeviceGetImageBufferEx2.argtypes = [HDEVICE, ctypes.POINTER(BYTE), UINT, ctypes.POINTER(DeviceFrameInfo)]
        self.DeviceGetImageBufferEx2.restype = DeviceStatus

        # 曝光相关：自动曝光开关 / 手动曝光时间
        self.SetAutoExposureState = getattr(self.dll, "SetAutoExposureState", None)
        if self.SetAutoExposureState is not None:
            # C原型: DeviceStatus SetAutoExposureState(HDEVICE hDevice, BOOL bAEState)
            self.SetAutoExposureState.argtypes = [HDEVICE, BOOL]
            self.SetAutoExposureState.restype = DeviceStatus

        self.GetAutoExposureState = getattr(self.dll, "GetAutoExposureState", None)
        if self.GetAutoExposureState is not None:
            # C原型: DeviceStatus GetAutoExposureState(HDEVICE hDevice, BOOL *pAEState)
            self.GetAutoExposureState.argtypes = [HDEVICE, ctypes.POINTER(BOOL)]
            self.GetAutoExposureState.restype = DeviceStatus

        self.SetExposureTime = getattr(self.dll, "SetExposureTime", None)
        if self.SetExposureTime is not None:
            # C原型: DeviceStatus SetExposureTime(HDEVICE hDevice, USHORT usExposureTime)
            self.SetExposureTime.argtypes = [HDEVICE, USHORT]
            self.SetExposureTime.restype = DeviceStatus

        self.GetExposureTime = getattr(self.dll, "GetExposureTime", None)
        if self.GetExposureTime is not None:
            # C原型: DeviceStatus GetExposureTime(HDEVICE hDevice, USHORT *pusExposureTime)
            self.GetExposureTime.argtypes = [HDEVICE, ctypes.POINTER(USHORT)]
            self.GetExposureTime.restype = DeviceStatus

        # 帧率相关：档位帧速 + 微调
        self.SetFrameSpeed = getattr(self.dll, "SetFrameSpeed", None)
        if self.SetFrameSpeed is not None:
            # C原型: DeviceStatus SetFrameSpeed(HDEVICE hDevice, emDeviceFrameSpeed dSpeed, BOOL bAutoTune)
            self.SetFrameSpeed.argtypes = [HDEVICE, INT, BOOL]
            self.SetFrameSpeed.restype = DeviceStatus

        self.GetFrameSpeed = getattr(self.dll, "GetFrameSpeed", None)
        if self.GetFrameSpeed is not None:
            # C原型: DeviceStatus GetFrameSpeed(HDEVICE hDevice, emDeviceFrameSpeed *pdSpeed)
            self.GetFrameSpeed.argtypes = [HDEVICE, ctypes.POINTER(INT)]
            self.GetFrameSpeed.restype = DeviceStatus

        self.SetFrameSpeedTune = getattr(self.dll, "SetFrameSpeedTune", None)
        if self.SetFrameSpeedTune is not None:
            # C原型: DeviceStatus SetFrameSpeedTune(HDEVICE hDevice, FLOAT fTune)
            self.SetFrameSpeedTune.argtypes = [HDEVICE, FLOAT]
            self.SetFrameSpeedTune.restype = DeviceStatus

        self.GetFrameSpeedTune = getattr(self.dll, "GetFrameSpeedTune", None)
        if self.GetFrameSpeedTune is not None:
            # C原型: DeviceStatus GetFrameSpeedTune(HDEVICE hDevice, FLOAT *pfTune)
            self.GetFrameSpeedTune.argtypes = [HDEVICE, ctypes.POINTER(FLOAT)]
            self.GetFrameSpeedTune.restype = DeviceStatus

        # 镜像相关：水平/垂直镜像开关
        self.SetMirror = getattr(self.dll, "SetMirror", None)
        if self.SetMirror is not None:
            # C原型: DeviceStatus SetMirror(HDEVICE hDevice, emMirrorDirection mDir, BOOL bEnable)
            self.SetMirror.argtypes = [HDEVICE, INT, BOOL]
            self.SetMirror.restype = DeviceStatus

        self.GetMirror = getattr(self.dll, "GetMirror", None)
        if self.GetMirror is not None:
            # C原型: DeviceStatus GetMirror(HDEVICE hDevice, emMirrorDirection mDir, BOOL *pEnable)
            self.GetMirror.argtypes = [HDEVICE, INT, ctypes.POINTER(BOOL)]
            self.GetMirror.restype = DeviceStatus

        # 白平衡相关：一次白平衡 / 自动白平衡 / 手动RGB增益
        self.SetOnceWBalace = getattr(self.dll, "SetOnceWBalace", None)
        if self.SetOnceWBalace is not None:
            # C原型: DeviceStatus SetOnceWBalace(HDEVICE hDevice)
            self.SetOnceWBalace.argtypes = [HDEVICE]
            self.SetOnceWBalace.restype = DeviceStatus

        self.SetAutoWBalaceState = getattr(self.dll, "SetAutoWBalaceState", None)
        if self.SetAutoWBalaceState is not None:
            # C原型: DeviceStatus SetAutoWBalaceState(HDEVICE hDevice, BOOL bAWBState)
            self.SetAutoWBalaceState.argtypes = [HDEVICE, BOOL]
            self.SetAutoWBalaceState.restype = DeviceStatus

        self.GetAutoWBalaceState = getattr(self.dll, "GetAutoWBalaceState", None)
        if self.GetAutoWBalaceState is not None:
            # C原型: DeviceStatus GetAutoWBalaceState(HDEVICE hDevice, BOOL *pAWBState)
            self.GetAutoWBalaceState.argtypes = [HDEVICE, ctypes.POINTER(BOOL)]
            self.GetAutoWBalaceState.restype = DeviceStatus

        self.SetGain = getattr(self.dll, "SetGain", None)
        if self.SetGain is not None:
            # C原型: DeviceStatus SetGain(HDEVICE hDevice, USHORT RGain, USHORT GGain, USHORT BGain)
            self.SetGain.argtypes = [HDEVICE, USHORT, USHORT, USHORT]
            self.SetGain.restype = DeviceStatus

        self.GetGain = getattr(self.dll, "GetGain", None)
        if self.GetGain is not None:
            # C原型: DeviceStatus GetGain(HDEVICE hDevice, USHORT *pRGain, USHORT *pGGain, USHORT *pBGain)
            self.GetGain.argtypes = [HDEVICE, ctypes.POINTER(USHORT), ctypes.POINTER(USHORT), ctypes.POINTER(USHORT)]
            self.GetGain.restype = DeviceStatus
        
    def initialize(self):
        """初始化SDK"""
        status = self.DeviceInitialSDK(None, False, True)
        if status == 0:
            self.initialized = True
            print("SDK初始化成功")
        return status
    
    def get_version(self):
        """获取SDK版本"""
        version_array = (DWORD * 4)()
        status = self.DeviceGetSDKVersion(ctypes.cast(version_array, ctypes.POINTER(DWORD * 4)))
        if status == 0:
            return tuple(version_array[i] for i in range(4))
        return None
    
    def open_camera(self, index=0):
        """打开指定索引的相机"""
        if not self.initialized:
            print("请先初始化SDK")
            return None
            
        h_device = HDEVICE()
        # 优先使用 OpenDeviceByIndex（若 DLL 导出），否则走 OpenDevice + flag
        if self.OpenDeviceByIndex is not None:
            status = self.OpenDeviceByIndex(UCHAR(index), ctypes.byref(h_device))
        else:
            if self.OpenDevice is None:
                print("DLL 未找到 OpenDevice/OpenDeviceByIndex 导出，无法打开设备")
                return None
            param = UionOpenDeviceParam()
            param.devIndex = UCHAR(index)
            status = self.OpenDevice(param, ctypes.byref(h_device), OF_BYPOSITION)
        
        if status == 0:
            self.device_handle = h_device
            print(f"相机 {index} 打开成功")
            return h_device
        else:
            print(f"打开相机失败，错误码: {status}")
            return None
    
    def close_camera(self):
        """关闭相机"""
        if self.device_handle:
            h = self.device_handle
            # 按手册要求：关闭前先 Stop + UnInit，避免直接退出导致内存错误
            try:
                self.DeviceStop(h)
            except Exception:
                pass

            try:
                self.DeviceUnInit(h)
            except Exception:
                pass

            self._streaming = False
            try:
                self.CloseDevice(h)
            except Exception:
                pass

            # 手册建议：CloseDevice 后继续释放引用
            try:
                if self.DeviceRelease is not None:
                    self.DeviceRelease(h)
            except Exception:
                pass
            self.device_handle = None
            print("相机已关闭")

    def uninitialize_sdk(self):
        """反初始化SDK（程序退出前建议调用）"""
        if self.initialized:
            status = self.DeviceUnInitialSDK()
            self.initialized = False
            return status
        return 0

    def enum_devices(self):
        """枚举设备，返回列表（index/usb/name）"""
        if not self.initialized:
            raise RuntimeError("请先初始化SDK")

        n = INT(0)
        status = self.EnumDevice(None, ctypes.byref(n))
        if status != 0 or n.value <= 0:
            return []

        arr = (EnumDeviceParam * n.value)()
        status = self.EnumDevice(ctypes.cast(arr, LPEnumDeviceParam), ctypes.byref(n))
        if status != 0:
            return []

        devices = []
        for i in range(n.value):
            name = bytes(arr[i].lpDeviceDesc).split(b"\x00", 1)[0].decode("utf-8", errors="ignore")
            devices.append(
                {
                    "list_index": i,
                    "devIndex": int(arr[i].devIndex),
                    "usbAddress": int(arr[i].usbAddress),
                    "name": name,
                }
            )
        return devices

    def init_camera_for_getmode(self, isp_type=DATA_ISP_RGB24, auto_param=True):
        """初始化相机为 GetMode + 指定 ISP 输出（用于 Python 拉流）"""
        if not self.device_handle:
            raise RuntimeError("请先打开相机")

        status = self.DeviceSetUsedGetMode(self.device_handle, True)
        if status != 0:
            return status

        status = self.DeviceSetISPDataType(self.device_handle, isp_type)
        if status != 0:
            return status

        # 不使用窗口句柄显示（None），在 Python/Opencv 里绘制
        status = self.DeviceInit(self.device_handle, None, True, bool(auto_param))
        return status

    def start_stream(self):
        if not self.device_handle:
            raise RuntimeError("请先打开相机")
        status = self.DeviceStart(self.device_handle)
        if status == 0:
            self._streaming = True
        return status

    def stop_stream(self):
        if not self.device_handle:
            return 0
        status = self.DeviceStop(self.device_handle)
        self.DeviceUnInit(self.device_handle)
        self._streaming = False
        return status

    def capture_frame(self, timeout_ms=1000, as_bgr=True):
        """抓取单帧图像，返回 np.ndarray。"""
        if not self.device_handle:
            raise RuntimeError("请先打开相机")
        if not self._streaming:
            raise RuntimeError("请先启动视频流")

        w = INT(0)
        h = INT(0)
        status = self.GetImageSize(self.device_handle, ctypes.byref(w), ctypes.byref(h))
        if status != 0 or w.value <= 0 or h.value <= 0:
            raise RuntimeError(f"GetImageSize 失败: {status}, w={w.value}, h={h.value}")

        rgb = (BYTE * (w.value * h.value * 3))()
        frame_info = DeviceFrameInfo()
        status = self.DeviceGetImageBufferEx2(
            self.device_handle,
            ctypes.cast(rgb, ctypes.POINTER(BYTE)),
            UINT(timeout_ms),
            ctypes.byref(frame_info),
        )
        if status != STATUS_OK:
            raise RuntimeError(f"取帧失败: {status}")

        img_rgb = np.frombuffer(rgb, dtype=np.uint8).reshape((h.value, w.value, 3))
        if as_bgr:
            return cv2.cvtColor(img_rgb, cv2.COLOR_RGB2BGR)
        return img_rgb

    def preview_opencv(self, window_name="CGimagetech", timeout_ms=1000):
        """使用 OpenCV 窗口实时预览，按 q/ESC 退出"""
        if not self.device_handle:
            raise RuntimeError("请先打开相机")

        # 初始化 + 打开流
        status = self.init_camera_for_getmode(isp_type=DATA_ISP_RGB24, auto_param=True)
        if status != 0:
            raise RuntimeError(f"DeviceInit(GetMode) 失败: {status}")

        status = self.start_stream()
        if status != 0:
            raise RuntimeError(f"DeviceStart 失败: {status}")

        w = INT(0)
        h = INT(0)
        status = self.GetImageSize(self.device_handle, ctypes.byref(w), ctypes.byref(h))
        if status != 0 or w.value <= 0 or h.value <= 0:
            raise RuntimeError(f"GetImageSize 失败: {status}, w={w.value}, h={h.value}")

        rgb = (BYTE * (w.value * h.value * 3))()
        frame_info = DeviceFrameInfo()

        cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)
        last_ts = time.time()
        while True:
            # 句柄已被其他线程关闭时，立即退出预览循环
            if not self.device_handle:
                break
            status = self.DeviceGetImageBufferEx2(
                self.device_handle,
                ctypes.cast(rgb, ctypes.POINTER(BYTE)),
                UINT(timeout_ms),
                ctypes.byref(frame_info),
            )
            if status == STATUS_OK:
                img = np.frombuffer(rgb, dtype=np.uint8).reshape((h.value, w.value, 3))
                bgr = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
                cv2.imshow(window_name, bgr)
                last_ts = time.time()
            else:
                # 超时就轻微等待，避免 CPU 飙高；其他错误直接提示
                if status == STATUS_INVALIDATE_HANDLE:
                    print("取帧失败: -9（无效句柄），预览将退出。")
                    break
                if status != STATUS_TIME_OUT:
                    print(f"取帧失败: {status}")
                if time.time() - last_ts > 5:
                    print("持续 5 秒未取到有效帧，请检查相机/参数。")
                    last_ts = time.time()
                time.sleep(0.005)

            key = cv2.waitKey(1) & 0xFF
            if key in (27, ord("q")):
                break

        cv2.destroyWindow(window_name)
        self.stop_stream()

    # ===== 曝光/帧率设置方法 =====
    def set_auto_exposure(self, enable=True):
        """设置自动曝光开关（True=自动曝光，False=手动曝光）"""
        if not self.device_handle:
            raise RuntimeError("请先打开相机")
        if self.SetAutoExposureState is None:
            raise NotImplementedError("DLL 未导出 SetAutoExposureState")
        return self.SetAutoExposureState(self.device_handle, BOOL(bool(enable)))

    def get_auto_exposure(self):
        """获取自动曝光状态，返回 (status, enabled)"""
        if not self.device_handle:
            raise RuntimeError("请先打开相机")
        if self.GetAutoExposureState is None:
            raise NotImplementedError("DLL 未导出 GetAutoExposureState")
        state = BOOL(0)
        status = self.GetAutoExposureState(self.device_handle, ctypes.byref(state))
        return status, bool(state.value)

    def set_exposure_time(self, exposure_time):
        """
        设置手动曝光时间（单位按手册为设备内部单位）。
        注意：建议先关闭自动曝光，再设置手动曝光。
        """
        if not self.device_handle:
            raise RuntimeError("请先打开相机")
        if self.SetExposureTime is None:
            raise NotImplementedError("DLL 未导出 SetExposureTime")
        return self.SetExposureTime(self.device_handle, USHORT(int(exposure_time)))

    def get_exposure_time(self):
        """获取当前曝光时间，返回 (status, exposure_time)"""
        if not self.device_handle:
            raise RuntimeError("请先打开相机")
        if self.GetExposureTime is None:
            raise NotImplementedError("DLL 未导出 GetExposureTime")
        val = USHORT(0)
        status = self.GetExposureTime(self.device_handle, ctypes.byref(val))
        return status, int(val.value)

    def set_frame_speed(self, speed_level=HIGH_SPEED, auto_tune=True):
        """
        设置帧率档位。
        speed_level:
            HIGHEST_SPEED / HIGH_SPEED / LOW_SPEED / LOWEST_SPEED
        """
        if not self.device_handle:
            raise RuntimeError("请先打开相机")
        if self.SetFrameSpeed is None:
            raise NotImplementedError("DLL 未导出 SetFrameSpeed")
        return self.SetFrameSpeed(self.device_handle, INT(int(speed_level)), BOOL(bool(auto_tune)))

    def get_frame_speed(self):
        """获取帧率档位，返回 (status, speed_level)"""
        if not self.device_handle:
            raise RuntimeError("请先打开相机")
        if self.GetFrameSpeed is None:
            raise NotImplementedError("DLL 未导出 GetFrameSpeed")
        level = INT(0)
        status = self.GetFrameSpeed(self.device_handle, ctypes.byref(level))
        return status, int(level.value)

    def set_frame_speed_tune(self, tune=1.0):
        """设置帧率微调（0.0~1.0，手册说明需 >0）"""
        if not self.device_handle:
            raise RuntimeError("请先打开相机")
        if self.SetFrameSpeedTune is None:
            raise NotImplementedError("DLL 未导出 SetFrameSpeedTune")
        return self.SetFrameSpeedTune(self.device_handle, FLOAT(float(tune)))

    def get_frame_speed_tune(self):
        """获取帧率微调，返回 (status, tune)"""
        if not self.device_handle:
            raise RuntimeError("请先打开相机")
        if self.GetFrameSpeedTune is None:
            raise NotImplementedError("DLL 未导出 GetFrameSpeedTune")
        tune = FLOAT(0.0)
        status = self.GetFrameSpeedTune(self.device_handle, ctypes.byref(tune))
        return status, float(tune.value)

    # ===== 图像镜像设置方法 =====
    def set_mirror(self, direction=MD_HORIZONTAL, enable=True):
        """设置镜像状态（direction: MD_HORIZONTAL 或 MD_VERTICAL）"""
        if not self.device_handle:
            raise RuntimeError("请先打开相机")
        if self.SetMirror is None:
            raise NotImplementedError("DLL 未导出 SetMirror")
        return self.SetMirror(self.device_handle, INT(int(direction)), BOOL(bool(enable)))

    def get_mirror(self, direction=MD_HORIZONTAL):
        """获取镜像状态，返回 (status, enabled)"""
        if not self.device_handle:
            raise RuntimeError("请先打开相机")
        if self.GetMirror is None:
            raise NotImplementedError("DLL 未导出 GetMirror")
        enabled = BOOL(0)
        status = self.GetMirror(self.device_handle, INT(int(direction)), ctypes.byref(enabled))
        return status, bool(enabled.value)

    def set_horizontal_mirror(self, enable=True):
        """设置水平镜像"""
        return self.set_mirror(MD_HORIZONTAL, enable)

    def set_vertical_mirror(self, enable=True):
        """设置垂直镜像"""
        return self.set_mirror(MD_VERTICAL, enable)

    # ===== 白平衡设置方法 =====
    def set_auto_white_balance(self, enable=True):
        """设置自动白平衡开关（True=开，False=关）"""
        if not self.device_handle:
            raise RuntimeError("请先打开相机")
        if self.SetAutoWBalaceState is None:
            raise NotImplementedError("DLL 未导出 SetAutoWBalaceState")
        return self.SetAutoWBalaceState(self.device_handle, BOOL(bool(enable)))

    def get_auto_white_balance(self):
        """获取自动白平衡状态，返回 (status, enabled)"""
        if not self.device_handle:
            raise RuntimeError("请先打开相机")
        if self.GetAutoWBalaceState is None:
            raise NotImplementedError("DLL 未导出 GetAutoWBalaceState")
        state = BOOL(0)
        status = self.GetAutoWBalaceState(self.device_handle, ctypes.byref(state))
        return status, bool(state.value)

    def once_white_balance(self):
        """执行一次白平衡（手册接口名：SetOnceWBalace）"""
        if not self.device_handle:
            raise RuntimeError("请先打开相机")
        if self.SetOnceWBalace is None:
            raise NotImplementedError("DLL 未导出 SetOnceWBalace")
        return self.SetOnceWBalace(self.device_handle)

    def set_white_balance_gain(self, r_gain, g_gain, b_gain):
        """
        设置手动白平衡增益（RGB三通道）。
        注意：建议先关闭自动白平衡再设置。
        """
        if not self.device_handle:
            raise RuntimeError("请先打开相机")
        if self.SetGain is None:
            raise NotImplementedError("DLL 未导出 SetGain")
        return self.SetGain(
            self.device_handle,
            USHORT(int(r_gain)),
            USHORT(int(g_gain)),
            USHORT(int(b_gain)),
        )

    def get_white_balance_gain(self):
        """获取手动白平衡增益，返回 (status, r_gain, g_gain, b_gain)"""
        if not self.device_handle:
            raise RuntimeError("请先打开相机")
        if self.GetGain is None:
            raise NotImplementedError("DLL 未导出 GetGain")
        r = USHORT(0)
        g = USHORT(0)
        b = USHORT(0)
        status = self.GetGain(self.device_handle, ctypes.byref(r), ctypes.byref(g), ctypes.byref(b))
        return status, int(r.value), int(g.value), int(b.value)
    
    def __enter__(self):
        """上下文管理器入口"""
        self.initialize()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """上下文管理器退出"""
        self.close_camera()


