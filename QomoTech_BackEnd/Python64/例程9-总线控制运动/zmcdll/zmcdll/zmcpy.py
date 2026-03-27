import platform
import ctypes

# 运行环境判断
my_system = platform.system()
if my_system == 'Windows':
    if platform.architecture()[0] == '64bit':
        z_aux_dll = ctypes.WinDLL('../zauxdll.dll')
        print('Windows x64')
    else:
        z_aux_dll = ctypes.WinDLL('../zauxdll.dll')
        print('Windows x86')
else:
    print('OS not supported!')


class ZmcFun:

    # 初始化参数
    def __init__(self):
        self.handle = ctypes.c_void_p()

    # # # # 控制器链接 # # # #

    # 串口链接控制器
    def open_com(self, com_id):
        if self.handle.value is not None:
            self.close()
        com_id = ctypes.c_uint32(com_id)
        p_handle = ctypes.pointer(self.handle)
        ret = z_aux_dll.ZAux_OpenCom(com_id, p_handle)
        if ret != 0:
            print('open_com', 'error', ret)
        return ret

    # 设置串口通讯参数
    @staticmethod
    def set_com_default_baud(baud_rate, byte_size, parity, stop_bits):
        baud_rate = ctypes.c_uint32(baud_rate)
        byte_size = ctypes.c_uint32(byte_size)
        parity = ctypes.c_uint32(parity)
        stop_bits = ctypes.c_uint32(stop_bits)
        ret = z_aux_dll.ZAux_SetComDefaultBaud(baud_rate, byte_size, parity, stop_bits)
        if ret != 0:
            print('set_com_default_baud', 'error', ret)
        return ret

    # 以太网链接控制器
    def open_eth(self, ip_address):
        if self.handle.value is not None:
            self.close()
        ip_address = ctypes.c_char_p(ip_address.encode('utf-8'))
        p_handle = ctypes.pointer(self.handle)
        ret = z_aux_dll.ZAux_OpenEth(ip_address, p_handle)
        if ret != 0:
            print('open_eth', 'error', ret)
        return ret

    # PCI卡连接
    def open_pci(self, card_num):
        if self.handle.value is not None:
            self.close()
        card_num = ctypes.c_uint32(card_num)
        p_handle = ctypes.pointer(self.handle)
        ret = z_aux_dll.ZAux_OpenPci(card_num, p_handle)
        if ret != 0:
            print('open_pci', 'error', ret)
        return ret

    # 关闭控制器链接
    def close(self):
        ret = z_aux_dll.ZAux_Close(self.handle)
        if ret != 0:
            print('close', 'error', ret)
        return ret

    # 设置控制器IP
    def set_ip(self, ip_address):
        ip_address = ctypes.c_char_p(ip_address.encode('utf-8'))
        ret = z_aux_dll.ZAux_SetIp(self.handle, ip_address)
        if ret != 0:
            print('set_ip', 'error', ret)
        return ret

    # 搜索当前网段下的控制器IP
    @staticmethod
    def search_eth_list(ip_address_list, address_buff_length, ms):
        # ip_address_list = ctypes.c_char_p(ip_address_list.encode('utf-8'))
        address_buff_length = ctypes.c_uint32(address_buff_length)
        ms = ctypes.c_uint32(ms)
        ret = z_aux_dll.ZAux_SearchEthlist(ip_address_list, address_buff_length, ms)
        if ret != 0:
            print('search_eth_list', 'error', ret)
        return ret

    # 快速与控制器建立链接
    @staticmethod
    def search_and_open_com(min_com_id_find, max_com_id_find, com_id, ms):
        min_com_id_find = ctypes.c_uint32(min_com_id_find)
        max_com_id_find = ctypes.c_uint32(max_com_id_find)
        com_id = ctypes.pointer(ctypes.c_uint(com_id))
        ms = ctypes.c_uint32(ms)
        ret = z_aux_dll.ZAux_SearchAndOpenCom(min_com_id_find, max_com_id_find, com_id, ms)
        if ret != 0:
            print('search_and_open_com', 'error', ret)
        return ret

    # 快速检索IP列表
    @staticmethod
    def search_eth(ip_address, ms):
        ip_address = ctypes.c_char_p(ip_address.encode('utf-8'))
        ms = ctypes.c_uint32(ms)
        ret = z_aux_dll.ZAux_SearchEth(ip_address, ms)
        if ret != 0:
            print('search_eth', 'error', ret)
        return ret

    # 读取PCI卡的个数
    @staticmethod
    def get_max_pci_cards():
        return z_aux_dll.ZAux_GetMaxPciCards()

    # # # # 基本轴参数初始化 # # # #

    # 设置轴类型
    def set_axis_type(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.c_int(value)
        ret = z_aux_dll.ZAux_Direct_SetAtype(self.handle, axis, value)
        if ret != 0:
            print('set_axis_type', 'error', ret)
        return ret

    # 设置轴脉冲当量
    def set_units(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.c_float(value)
        ret = z_aux_dll.ZAux_Direct_SetUnits(self.handle, axis, value)
        if ret != 0:
            print('set_units', 'error', ret)
        return ret

    # 设置脉冲输出模式
    def set_invert_step(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.c_int(value)
        ret = z_aux_dll.ZAux_Direct_SetInvertStep(self.handle, axis, value)
        if ret != 0:
            print('set_invert_step', 'error', ret)
        return ret

    # 设置轴速度
    def set_speed(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.c_float(value)
        ret = z_aux_dll.ZAux_Direct_SetSpeed(self.handle, axis, value)
        if ret != 0:
            print('set_speed', 'error', ret)
        return ret

    # 设置轴加速度
    def set_acceleration(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.c_float(value)
        ret = z_aux_dll.ZAux_Direct_SetAccel(self.handle, axis, value)
        if ret != 0:
            print('set_acceleration', 'error', ret)
        return ret

    # 设置轴减速度
    def set_deceleration(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.c_float(value)
        ret = z_aux_dll.ZAux_Direct_SetDecel(self.handle, axis, value)
        if ret != 0:
            print('set_deceleration', 'error', ret)
        return ret

    # 设置轴S曲线
    def set_s_curve(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.c_float(value)
        ret = z_aux_dll.ZAux_Direct_SetSramp(self.handle, axis, value)
        if ret != 0:
            print('set_s_curve', 'error', ret)
        return ret

    # 读取轴类型
    def get_axis_type(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetAtype(self.handle, axis, value)
        if ret != 0:
            print('get_axis_type', 'error', ret)
        return ret

    # 读取轴脉冲当量
    def get_units(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetUnits(self.handle, axis, value)
        if ret != 0:
            print('get_units', 'error', ret)
        return ret

    # 读取脉冲输出模式
    def get_invert_step(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetInvertStep(self.handle, axis, value)
        if ret != 0:
            print('get_invert_step', 'error', ret)
        return ret

    # 读取轴速度
    def get_speed(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetSpeed(self.handle, axis, value)
        if ret != 0:
            print('get_speed', 'error', ret)
        return ret

    # 读取轴加速度
    def get_acceleration(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetAccel(self.handle, axis, value)
        if ret != 0:
            print('get_acceleration', 'error', ret)
        return ret

    # 读取轴减速度
    def get_deceleration(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetDecel(self.handle, axis, value)
        if ret != 0:
            print('get_deceleration', 'error', ret)
        return ret

    # 读取轴S曲线
    def get_s_ramp(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetSramp(self.handle, axis, value)
        if ret != 0:
            print('get_s_ramp', 'error', ret)
        return ret

    # # # # 特殊IO配置 # # # #

    # 设置轴原点信号
    def set_datum_in(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.c_int(value)
        ret = z_aux_dll.ZAux_Direct_SetDatumIn(self.handle, axis, value)
        if ret != 0:
            print('set_datum_in', 'error', ret)
        return ret

    # 设置轴正向限位信号
    def set_fwd_in(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.c_int(value)
        ret = z_aux_dll.ZAux_Direct_SetFwdIn(self.handle, axis, value)
        if ret != 0:
            print('set_fwd_in', 'error', ret)
        return ret

    # 设置轴负向限位信号
    def set_rev_in(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.c_int(value)
        ret = z_aux_dll.ZAux_Direct_SetRevIn(self.handle, axis, value)
        if ret != 0:
            print('set_rev_in', 'error', ret)
        return ret

    # 设置轴伺服告警信号
    def set_alm_in(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.c_int(value)
        ret = z_aux_dll.ZAux_Direct_SetAlmIn(self.handle, axis, value)
        if ret != 0:
            print('set_alm_in', 'error', ret)
        return ret

    # 设置输入口信号反转状态
    def set_invert_in(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.c_int(value)
        ret = z_aux_dll.ZAux_Direct_SetInvertIn(self.handle, axis, value)
        if ret != 0:
            print('set_invert_in', 'error', ret)
        return ret

    # 设置快速JOG输入
    def set_fast_jog_in(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.c_int(value)
        ret = z_aux_dll.ZAux_Direct_SetFastJog(self.handle, axis, value)
        if ret != 0:
            print('set_fast_jog_in', 'error', ret)
        return ret

    # 设置正向JOG输入
    def set_fwd_jog_in(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.c_int(value)
        ret = z_aux_dll.ZAux_Direct_SetFwdJog(self.handle, axis, value)
        if ret != 0:
            print('set_fwd_jog_in', 'error', ret)
        return ret

    # 设置负向JOG输入
    def set_rev_jog_in(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.c_int(value)
        ret = z_aux_dll.ZAux_Direct_SetRevJog(self.handle, axis, value)
        if ret != 0:
            print('set_rev_jog_in', 'error', ret)
        return ret

    # 设置保持输入
    def set_hold_in(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.c_int(value)
        ret = z_aux_dll.ZAux_Direct_SetFholdIn(self.handle, axis, value)
        if ret != 0:
            print('set_hold_in', 'error', ret)
        return ret

    # 读取轴原点信号
    def get_datum_in(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetDatumIn(self.handle, axis, value)
        if ret != 0:
            print('get_datum_in', 'error', ret)
        return ret

    # 读取轴正向限位信号
    def get_fwd_in(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetFwdIn(self.handle, axis, value)
        if ret != 0:
            print('get_fwd_in', 'error', ret)
        return ret

    # 读取轴负向限位信号
    def get_rev_in(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetRevIn(self.handle, axis, value)
        if ret != 0:
            print('get_rev_in', 'error', ret)
        return ret

    # 读取伺服告警信号
    def get_alm_in(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetAlmIn(self.handle, axis, value)
        if ret != 0:
            print('get_alm_in', 'error', ret)
        return ret

    # 读取输入口信号反转状态
    def get_invert_in(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetInvertIn(self.handle, axis, value)
        if ret != 0:
            print('get_invert_in', 'error', ret)
        return ret

    # 读取快速JOG输入
    def get_fast_jog_in(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetFastJog(self.handle, axis, value)
        if ret != 0:
            print('get_fast_jog_in', 'error', ret)
        return ret

    # 读取正向JOG输入
    def get_fwd_jog_in(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetFwdJog(self.handle, axis, value)
        if ret != 0:
            print('get_fwd_jog_in', 'error', ret)
        return ret

    # 读取反向JOG输入
    def get_rev_jog_in(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetRevJog(self.handle, axis, value)
        if ret != 0:
            print('get_rev_jog_in', 'error', ret)
        return ret

    # 读取保持输入
    def get_hold_in(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetFholdIn(self.handle, axis, value)
        if ret != 0:
            print('get_hold_in', 'error', ret)
        return ret

    # # # # 轴参数及参数 # # # #

    # BASE调用
    def base(self, max_axis, axis_list):
        max_axis = ctypes.c_int(max_axis)
        # axis_list = ctypes.pointer(ctypes.c_int(axis_list))
        ret = z_aux_dll.ZAux_Direct_Base(self.handle, max_axis, axis_list)
        if ret != 0:
            print('base', 'error', ret)
        return ret

    # 定义POS
    def define_pos(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.c_float(value)
        ret = z_aux_dll.ZAux_Direct_Defpos(self.handle, axis, value)
        if ret != 0:
            print('define_pos', 'error', ret)
        return ret

    # 设置轴的位置
    def set_target_pos(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.c_float(value)
        ret = z_aux_dll.ZAux_Direct_SetDpos(self.handle, axis, value)
        if ret != 0:
            print('set_target_pos', 'error', ret)
        return ret

    # 设置编码器的反馈位置
    def set_feedback_pos(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.c_float(value)
        ret = z_aux_dll.ZAux_Direct_SetMpos(self.handle, axis, value)
        if ret != 0:
            print('set_feedback_pos', 'error', ret)
        return ret

    # 设置偏移位置
    def set_off_pos(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.c_float(value)
        ret = z_aux_dll.ZAux_Direct_SetOffpos(self.handle, axis, value)
        if ret != 0:
            print('set_off_pos', 'error', ret)
        return ret

    # 设置坐标循环位置
    def set_rep_dist(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.c_float(value)
        ret = z_aux_dll.ZAux_Direct_SetRepDist(self.handle, axis, value)
        if ret != 0:
            print('set_rep_dist', 'error', ret)
        return ret

    # 设置坐标循环模式
    def set_rep_option(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.c_int(value)
        ret = z_aux_dll.ZAux_Direct_SetRepOption(self.handle, axis, value)
        if ret != 0:
            print('set_rep_option', 'error', ret)
        return ret

    # 设置通用的参数
    def set_param(self, param, axis, value):
        param = ctypes.c_char_p(param.encode('utf-8'))
        axis = ctypes.c_int(axis)
        value = ctypes.c_float(value)
        ret = z_aux_dll.ZAux_Direct_SetParam(self.handle, param, axis, value)
        if ret != 0:
            print('set_param', 'error', ret)
        return ret

    # 设置快速减速度
    def set_fast_dec(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.c_float(value)
        ret = z_aux_dll.ZAux_Direct_SetFastDec(self.handle, axis, value)
        if ret != 0:
            print('set_fast_dec', 'error', ret)
        return ret

    # 设置轴的起始速度
    def set_origin_speed(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.c_float(value)
        ret = z_aux_dll.ZAux_Direct_SetLspeed(self.handle, axis, value)
        if ret != 0:
            print('set_origin_speed', 'error', ret)
        return ret

    # 设置轴的保持速度
    def set_hold_speed(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.c_float(value)
        ret = z_aux_dll.ZAux_Direct_SetFhspeed(self.handle, axis, value)
        if ret != 0:
            print('set_hold_speed', 'error', ret)
        return ret

    # 设置JOG时的速度
    def set_jog_speed(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.c_float(value)
        ret = z_aux_dll.ZAux_Direct_SetJogSpeed(self.handle, axis, value)
        if ret != 0:
            print('set_jog_speed', 'error', ret)
        return ret

    # 设置插补轴速度计算状态
    def set_interp_factor(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.c_int(value)
        ret = z_aux_dll.ZAux_Direct_SetInterpFactor(self.handle, axis, value)
        if ret != 0:
            print('set_interp_factor', 'error', ret)
        return ret

    # 设置正向软限位
    def set_fs_limit(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.c_float(value)
        ret = z_aux_dll.ZAux_Direct_SetFsLimit(self.handle, axis, value)
        if ret != 0:
            print('set_fs_limit', 'error', ret)
        return ret

    # 设置负向软限位
    def set_rs_limit(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.c_float(value)
        ret = z_aux_dll.ZAux_Direct_SetRsLimit(self.handle, axis, value)
        if ret != 0:
            print('set_rs_limit', 'error', ret)
        return ret

    # 设置最大允许的随动误差值
    def set_fe_limit(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.c_float(value)
        ret = z_aux_dll.ZAux_Direct_SetFeLimit(self.handle, axis, value)
        if ret != 0:
            print('set_fe_limit', 'error', ret)
        return ret

    # 设置报警时的随动误差值
    def set_fe_range(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.c_float(value)
        ret = z_aux_dll.ZAux_Direct_SetFRange(self.handle, axis, value)
        if ret != 0:
            print('set_fe_range', 'error', ret)
        return ret

    # 读取轴运动状态
    def get_idle(self, axis, value):
        axis = ctypes.c_int(axis)
        # value = ctypes.pointer(value)
        value = ctypes.byref(value)
        ret = z_aux_dll.ZAux_Direct_GetIfIdle(self.handle, axis, value)
        if ret != 0:
            print('get_idle', 'error', ret)
        return ret

    # 读取轴状态
    def get_axis_status(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetAxisStatus(self.handle, axis, value)
        if ret != 0:
            print('get_axis_status', 'error', ret)
        return ret

    # 读取全部轴参数状态
    def get_all_axis_info(self, max_axis, idle_status, target_pos_status, feedback_pos_status, axis_status):
        max_axis = ctypes.c_int(max_axis)
        # 所需参数皆为数组指针,所以需要在函数外部定义c的函数指针变量
        # idle_status = ctypes.pointer(ctypes.c_int(idle_status))
        # target_pos_status = ctypes.pointer(ctypes.c_float(target_pos_status))
        # feedback_pos_status = ctypes.pointer(ctypes.c_float(feedback_pos_status))
        # axis_status = ctypes.pointer(ctypes.c_int(axis_status))
        ret = z_aux_dll.ZAux_Direct_GetAllAxisInfo(self.handle, max_axis, idle_status, target_pos_status,
                                                   feedback_pos_status, axis_status)
        if ret != 0:
            print('get_all_axis_info', 'error', ret)
        return ret

    # 读取轴停止原因
    def get_axis_stop_reason(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetAxisStopReason(self.handle, axis, value)
        if ret != 0:
            print('get_axis_stop_reason', 'error', ret)
        return ret

    # 读取当前运动是否还有缓冲
    def get_loaded(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetLoaded(self.handle, axis, value)
        if ret != 0:
            print('get_loaded', 'error', ret)
        return ret

    # 读取轴的位置
    def get_target_pos(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetDpos(self.handle, axis, value)
        if ret != 0:
            print('get_target_pos', 'error', ret)
        return ret

    # 读取编码器的反馈位置
    def get_feedback_pos(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetMpos(self.handle, axis, value)
        if ret != 0:
            print('get_feedback_pos', 'error', ret)
        return ret

    # 快速读取连续轴的位置
    def get_modbus_target_pos(self, max_axis, value_list):
        max_axis = ctypes.c_int(max_axis)
        value_list = ctypes.pointer(value_list)
        ret = z_aux_dll.ZAux_GetModbusDpos(self.handle, max_axis, value_list)
        if ret != 0:
            print('get_modbus_target_pos', 'error', ret)
        return ret

    # 快速读取连续轴的反馈位置
    def get_modbus_feedback_pos(self, max_axis, value_list):
        max_axis = ctypes.c_int(max_axis)
        value_list = ctypes.pointer(value_list)
        ret = z_aux_dll.ZAux_GetModbusMpos(self.handle, max_axis, value_list)
        if ret != 0:
            print('get_modbus_feedback_pos', 'error', ret)
        return ret

    # 快速读取连续轴的当前速度
    def get_modbus_current_speed(self, max_axis, value_list):
        max_axis = ctypes.c_int(max_axis)
        value_list = ctypes.pointer(value_list)
        ret = z_aux_dll.ZAux_GetModbusCurSpeed(self.handle, max_axis, value_list)
        if ret != 0:
            print('get_modbus_current_speed', 'error', ret)
        return ret

    # 读取偏移位置
    def get_off_pos(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetOffpos(self.handle, axis, value)
        if ret != 0:
            print('get_off_pos', 'error', ret)
        return ret

    # 读取坐标循环位置
    def get_rep_dist(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetRepDist(self.handle, axis, value)
        if ret != 0:
            print('get_rep_dist', 'error', ret)
        return ret

    # 读取坐标循环模式
    def get_rep_option(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetRepOption(self.handle, axis, value)
        if ret != 0:
            print('get_rep_option', 'error', ret)
        return ret

    # 读取通用的参数
    def get_param(self, param, axis, value):
        param = ctypes.c_char_p(param.encode('utf-8'))
        axis = ctypes.c_int(axis)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetParam(self.handle, param, axis, value)
        if ret != 0:
            print('get_param', 'error', ret)
        return ret

    # 读取全部轴特定的参数信息
    def get_all_axis_param(self, param, max_axis, value):
        param = ctypes.c_char_p(param.encode('utf-8'))
        max_axis = ctypes.c_int(max_axis)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetAllAxisPara(self.handle, param, max_axis, value)
        if ret != 0:
            print('get_all_axis_param', 'error', ret)
        return ret

    # 读取快速减速度
    def get_fast_dec(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetFastDec(self.handle, axis, value)
        if ret != 0:
            print('get_fast_dec', 'error', ret)
        return ret

    # 读取轴的起始速度
    def get_origin_speed(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetLspeed(self.handle, axis, value)
        if ret != 0:
            print('get_origin_speed', 'error', ret)
        return ret

    # 读取轴的保持速度
    def get_hold_speed(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetFhspeed(self.handle, axis, value)
        if ret != 0:
            print('get_hold_speed', 'error', ret)
        return ret

    # 读取JOG时的速度
    def get_jog_speed(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetJogSpeed(self.handle, axis, value)
        if ret != 0:
            print('get_jog_speed', 'error', ret)
        return ret

    # 读取轴的当前运动速度
    def get_vp_speed(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetVpSpeed(self.handle, axis, value)
        if ret != 0:
            print('get_vp_speed', 'error', ret)
        return ret

    # 读取插补轴速度计算状态
    def get_interp_factor(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetInterpFactor(self.handle, axis, value)
        if ret != 0:
            print('get_interp_factor', 'error', ret)
        return ret

    # 读取正向软限位
    def get_fs_limit(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetFsLimit(self.handle, axis, value)
        if ret != 0:
            print('get_fs_limit', 'error', ret)
        return ret

    # 读取负向软限位
    def get_rs_limit(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetRsLimit(self.handle, axis, value)
        if ret != 0:
            print('get_rs_limit', 'error', ret)
        return ret

    # 读取最大允许的随动误差值
    def get_fe_limit(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetFeLimit(self.handle, axis, value)
        if ret != 0:
            print('get_fe_limit', 'error', ret)
        return ret

    # 读取报警时的随动误差值
    def get_fe_range(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetFeRange(self.handle, axis, value)
        if ret != 0:
            print('get_fe_range', 'error', ret)
        return ret

    # 读取随动误差
    def get_fe(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetFe(self.handle, axis, value)
        if ret != 0:
            print('get_fe', 'error', ret)
        return ret

    # 读取叠加轴
    def get_add_axis(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetAddax(self.handle, axis, value)
        if ret != 0:
            print('get_add_axis', 'error', ret)
        return ret

    # 读取连接轴
    def get_link_axis(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetLinkax(self.handle, axis, value)
        if ret != 0:
            print('get_link_axis', 'error', ret)
        return ret

    # 读取当前运动的目标位置
    def get_end_move(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetEndMove(self.handle, axis, value)
        if ret != 0:
            print('get_end_move', 'error', ret)
        return ret

    # 读取所有运动的目标位置
    def get_end_move_buffer(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetEndMoveBuffer(self.handle, axis, value)
        if ret != 0:
            print('get_end_move_buffer', 'error', ret)
        return ret

    # 读取当前被缓冲的运动个数
    def get_moves_buffered(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetMovesBuffered(self.handle, axis, value)
        if ret != 0:
            print('get_moves_buffered', 'error', ret)
        return ret

    # 读取当前运动的运动标号
    def get_move_current_mark(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetMoveCurmark(self.handle, axis, value)
        if ret != 0:
            print('get_move_current_mark', 'error', ret)
        return ret

    # 读取当前运动的运动类型
    def get_current_type(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetMtype(self.handle, axis, value)
        if ret != 0:
            print('get_current_type', 'error', ret)
        return ret

    # 读取下一条运动的运动类型
    def get_next_type(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetNtype(self.handle, axis, value)
        if ret != 0:
            print('get_next_type', 'error', ret)
        return ret

    # 读取当前运动未完成的距离
    def get_remain(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetRemain(self.handle, axis, value)
        if ret != 0:
            print('get_remain', 'error', ret)
        return ret

    # 读取所有运动未完成的距离
    def get_vector_buffered(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetVectorBuffered(self.handle, axis, value)
        if ret != 0:
            print('get_vector_buffered', 'error', ret)
        return ret

    # 读取轴剩余的直线缓冲数
    def get_remain_line_buffer(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetRemain_LineBuffer(self.handle, axis, value)
        if ret != 0:
            print('get_remain_line_buffer', 'error', ret)
        return ret

    # # # # 点位运动 # # # #

    # 单轴连续运动
    def single_continue_move(self, axis, direction):
        axis = ctypes.c_int(axis)
        direction = ctypes.c_int(direction)
        ret = z_aux_dll.ZAux_Direct_Single_Vmove(self.handle, axis, direction)
        if ret != 0:
            print('single_continue_move', 'error', ret)
        return ret

    # 单轴相对运动
    def single_move(self, axis, distance):
        axis = ctypes.c_int(axis)
        distance = ctypes.c_float(distance)
        ret = z_aux_dll.ZAux_Direct_Single_Move(self.handle, axis, distance)
        if ret != 0:
            print('single_move', 'error', ret)
        return ret

    # 单轴绝对运动
    def single_move_abs(self, axis, distance):
        axis = ctypes.c_int(axis)
        distance = ctypes.c_float(distance)
        ret = z_aux_dll.ZAux_Direct_Single_MoveAbs(self.handle, axis, distance)
        if ret != 0:
            print('single_move_abs', 'error', ret)
        return ret

    # 单轴停止运动
    def single_cancel(self, axis, mode):
        axis = ctypes.c_int(axis)
        mode = ctypes.c_int(mode)
        ret = z_aux_dll.ZAux_Direct_Single_Cancel(self.handle, axis, mode)
        if ret != 0:
            print('single_cancel', 'error', ret)
        return ret

    # 单轴轴叠加运动
    def single_add_axis(self, axis, add_axis):
        axis = ctypes.c_int(axis)
        add_axis = ctypes.c_int(add_axis)
        ret = z_aux_dll.ZAux_Direct_Single_Addax(self.handle, axis, add_axis)
        if ret != 0:
            print('single_add_axis', 'error', ret)
        return ret

    # # # # 回零运动 # # # #

    # 单轴回零运动
    def single_datum(self, axis, mode):
        axis = ctypes.c_int(axis)
        mode = ctypes.c_int(mode)
        ret = z_aux_dll.ZAux_Direct_Single_Datum(self.handle, axis, mode)
        if ret != 0:
            print('single_datum', 'error', ret)
        return ret

    # 设置回零爬行速度
    def set_creep(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.c_float(value)
        ret = z_aux_dll.ZAux_Direct_SetCreep(self.handle, axis, value)
        if ret != 0:
            print('set_creep', 'error', ret)
        return ret

    # 设置回零反找等待时间
    def set_home_wait(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.c_int(value)
        ret = z_aux_dll.ZAux_Direct_SetHomeWait(self.handle, axis, value)
        if ret != 0:
            print('set_home_wait', 'error', ret)
        return ret

    # 读取回零爬行速度
    def get_creep(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetCreep(self.handle, axis, value)
        if ret != 0:
            print('get_creep', 'error', ret)
        return ret

    # 读取回零反找等待时间
    def get_home_wait(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetHomeWait(self.handle, axis, value)
        if ret != 0:
            print('get_home_wait', 'error', ret)
        return ret

    # # # # 电子齿轮 # # # #

    # 同步运动
    def connect(self, ratio, link_axis, move_axis):
        ratio = ctypes.c_float(ratio)
        link_axis = ctypes.c_int(link_axis)
        move_axis = ctypes.c_int(move_axis)
        ret = z_aux_dll.ZAux_Direct_Connect(self.handle, ratio, link_axis, move_axis)
        if ret != 0:
            print('connect', 'error', ret)
        return ret

    # 同步运动
    def connect_path(self, ratio, link_axis, move_axis):
        ratio = ctypes.c_int(ratio)
        link_axis = ctypes.c_int(link_axis)
        move_axis = ctypes.c_int(move_axis)
        ret = z_aux_dll.ZAux_Direct_Connpath(self.handle, ratio, link_axis, move_axis)
        if ret != 0:
            print('connect_path', 'error', ret)
        return ret

    # 设置链接速率
    def set_clutch_rate(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.c_float(value)
        ret = z_aux_dll.ZAux_Direct_SetClutchRate(self.handle, axis, value)
        if ret != 0:
            print('set_clutch_rate', 'error', ret)
        return ret

    # 读取链接速率
    def get_clutch_rate(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetClutchRate(self.handle, axis, value)
        if ret != 0:
            print('get_clutch_rate', 'error', ret)
        return ret

    # # # # 多轴插补运动 # # # #

    # 相对直线插补运动
    def move(self, max_axis, axis_list, distance_list):
        max_axis = ctypes.c_int(max_axis)
        # axis_list_ = (ctypes.c_int * max_axis.value)()
        # distance_list_ = (ctypes.c_float * max_axis.value)()
        # for i in range(0,max_axis):
        #     print(axis_list[i])
        #     axis_list_[i] = axis_list[i]
        #
        # for i in range(0,max_axis):
        #     print(distance_list[i])
        #     distance_list_[i] = distance_list[i]
        ret = z_aux_dll.ZAux_Direct_Move(self.handle, max_axis, axis_list, distance_list)
        if ret != 0:
            print('move', 'error', ret)
        return ret

    # 相对直线插补SP运动
    def move_sp(self, max_axis, axis_list, distance_list):
        max_axis = ctypes.c_int(max_axis)
        # axis_list = ctypes.pointer(ctypes.c_int(axis_list))
        # distance_list = ctypes.pointer(ctypes.c_float(distance_list))
        ret = z_aux_dll.ZAux_Direct_MoveSp(self.handle, max_axis, axis_list, distance_list)
        if ret != 0:
            print('move_sp', 'error', ret)
        return ret

    # 绝对直线插补运动
    def move_abs(self, max_axis, axis_list, distance_list):
        max_axis = ctypes.c_int(max_axis)
        # axis_list = ctypes.pointer(ctypes.c_int(axis_list))
        # distance_list = ctypes.pointer(ctypes.c_float(distance_list))
        ret = z_aux_dll.ZAux_Direct_MoveAbs(self.handle, max_axis, axis_list, distance_list)
        if ret != 0:
            print('move_abs', 'error', ret)
        return ret

    # 绝对直线插补SP运动
    def move_abs_sp(self, max_axis, axis_list, distance_list):
        max_axis = ctypes.c_int(max_axis)
        # axis_list = ctypes.pointer(ctypes.c_int(axis_list))
        # distance_list = ctypes.pointer(distance_list)
        ret = z_aux_dll.ZAux_Direct_MoveAbsSp(self.handle, max_axis, axis_list, distance_list)
        if ret != 0:
            print('move_abs_sp', 'error', ret)
        return ret

    # 多条相对直线插补运动
    def move_multi(self, move_length, max_axis, axis_list, distance_list):
        move_length = ctypes.c_int(move_length)
        max_axis = ctypes.c_int(max_axis)
        # axis_list = ctypes.pointer(ctypes.c_int(axis_list))
        # distance_list = ctypes.pointer(ctypes.c_float(distance_list))
        ret = z_aux_dll.ZAux_Direct_MultiMove(self.handle, move_length, max_axis, axis_list, distance_list)
        if ret != 0:
            print('move_multi', 'error', ret)
        return ret

    # 多条绝对直线插补运动
    def move_multi_abs(self, move_length, max_axis, axis_list, distance_list):
        move_length = ctypes.c_int(move_length)
        max_axis = ctypes.c_int(max_axis)
        # axis_list = ctypes.pointer(ctypes.c_int(axis_list))
        # distance_list = ctypes.pointer(ctypes.c_float(distance_list))
        ret = z_aux_dll.ZAux_Direct_MultiMoveAbs(self.handle, move_length, max_axis, axis_list, distance_list)
        if ret != 0:
            print('move_multi_abs', 'error', ret)
        return ret

    # 相对圆心圆弧插补运动
    def move_circle(self, max_axis, axis_list, end_pos1, end_pos2, center_pos1, center_pos2, direction):
        max_axis = ctypes.c_int(max_axis)
        # axis_list = ctypes.pointer(ctypes.c_int(axis_list))
        end_pos1 = ctypes.c_float(end_pos1)
        end_pos2 = ctypes.c_float(end_pos2)
        center_pos1 = ctypes.c_float(center_pos1)
        center_pos2 = ctypes.c_float(center_pos2)
        direction = ctypes.c_int(direction)
        ret = z_aux_dll.ZAux_Direct_MoveCirc(self.handle, max_axis, axis_list, end_pos1, end_pos2,
                                             center_pos1, center_pos2, direction)
        if ret != 0:
            print('move_circle', 'error', ret)
        return ret

    # 相对圆心圆弧插补SP运动
    def move_circle_sp(self, max_axis, axis_list, end_pos1, end_pos2, center_pos1, center_pos2, direction):
        max_axis = ctypes.c_int(max_axis)
        # axis_list = ctypes.pointer(ctypes.c_int(axis_list))
        end_pos1 = ctypes.c_float(end_pos1)
        end_pos2 = ctypes.c_float(end_pos2)
        center_pos1 = ctypes.c_float(center_pos1)
        center_pos2 = ctypes.c_float(center_pos2)
        direction = ctypes.c_int(direction)
        ret = z_aux_dll.ZAux_Direct_MoveCircSp(self.handle, max_axis, axis_list, end_pos1, end_pos2,
                                               center_pos1, center_pos2, direction)
        if ret != 0:
            print('move_circle_sp', 'error', ret)
        return ret

    # 绝对圆心圆弧插补运动
    def move_circle_abs(self, max_axis, axis_list, end_pos1, end_pos2, center_pos1, center_pos2, direction):
        max_axis = ctypes.c_int(max_axis)
        # axis_list = ctypes.pointer(ctypes.c_int(axis_list))
        end_pos1 = ctypes.c_float(end_pos1)
        end_pos2 = ctypes.c_float(end_pos2)
        center_pos1 = ctypes.c_float(center_pos1)
        center_pos2 = ctypes.c_float(center_pos2)
        direction = ctypes.c_int(direction)
        ret = z_aux_dll.ZAux_Direct_MoveCircAbs(self.handle, max_axis, axis_list, end_pos1, end_pos2,
                                                center_pos1, center_pos2, direction)
        if ret != 0:
            print('move_circle_abs', 'error', ret)
        return ret

    # 绝对圆心圆弧插补SP运动
    def move_circle_abs_sp(self, max_axis, axis_list, end_pos1, end_pos2, center_pos1, center_pos2, direction):
        max_axis = ctypes.c_int(max_axis)
        # axis_list = ctypes.pointer(ctypes.c_int(axis_list))
        end_pos1 = ctypes.c_float(end_pos1)
        end_pos2 = ctypes.c_float(end_pos2)
        center_pos1 = ctypes.c_float(center_pos1)
        center_pos2 = ctypes.c_float(center_pos2)
        direction = ctypes.c_int(direction)
        ret = z_aux_dll.ZAux_Direct_MoveCircAbsSp(self.handle, max_axis, axis_list, end_pos1, end_pos2,
                                                  center_pos1, center_pos2, direction)
        if ret != 0:
            print('move_circle_abs_sp', 'error', ret)
        return ret

    # 相对三点圆弧插补运动
    def move_circle2(self, max_axis, axis_list, middle_pos1, middle_pos2, end_pos1, end_pos2):
        max_axis = ctypes.c_int(max_axis)
        # axis_list = ctypes.pointer(ctypes.c_int(axis_list))
        middle_pos1 = ctypes.c_float(middle_pos1)
        middle_pos2 = ctypes.c_float(middle_pos2)
        end_pos1 = ctypes.c_float(end_pos1)
        end_pos2 = ctypes.c_float(end_pos2)
        ret = z_aux_dll.ZAux_Direct_MoveCirc2(self.handle, max_axis, axis_list, middle_pos1, middle_pos2,
                                              end_pos1, end_pos2)
        if ret != 0:
            print('move_circle2', 'error', ret)
        return ret

    # 相对三点圆弧插补SP运动
    def move_circle2_sp(self, max_axis, axis_list, middle_pos1, middle_pos2, end_pos1, end_pos2):
        max_axis = ctypes.c_int(max_axis)
        # axis_list = ctypes.pointer(ctypes.c_int(axis_list))
        middle_pos1 = ctypes.c_float(middle_pos1)
        middle_pos2 = ctypes.c_float(middle_pos2)
        end_pos1 = ctypes.c_float(end_pos1)
        end_pos2 = ctypes.c_float(end_pos2)
        ret = z_aux_dll.ZAux_Direct_MoveCirc2Sp(self.handle, max_axis, axis_list, middle_pos1, middle_pos2,
                                                end_pos1, end_pos2)
        if ret != 0:
            print('move_circle2_sp', 'error', ret)
        return ret

    # 绝对三点圆弧插补运动
    def move_circle2_abs(self, max_axis, axis_list, middle_pos1, middle_pos2, end_pos1, end_pos2):
        max_axis = ctypes.c_int(max_axis)
        # axis_list = ctypes.pointer(ctypes.c_int(axis_list))
        middle_pos1 = ctypes.c_float(middle_pos1)
        middle_pos2 = ctypes.c_float(middle_pos2)
        end_pos1 = ctypes.c_float(end_pos1)
        end_pos2 = ctypes.c_float(end_pos2)
        ret = z_aux_dll.ZAux_Direct_MoveCirc2Abs(self.handle, max_axis, axis_list, middle_pos1, middle_pos2,
                                                 end_pos1, end_pos2)
        if ret != 0:
            print('move_circle2_abs', 'error', ret)
        return ret

    # 绝对三点圆弧插补SP运动
    def move_circle2_abs_sp(self, max_axis, axis_list, middle_pos1, middle_pos2, end_pos1, end_pos2):
        max_axis = ctypes.c_int(max_axis)
        # axis_list = ctypes.pointer(ctypes.c_int(axis_list))
        middle_pos1 = ctypes.c_float(middle_pos1)
        middle_pos2 = ctypes.c_float(middle_pos2)
        end_pos1 = ctypes.c_float(end_pos1)
        end_pos2 = ctypes.c_float(end_pos2)
        ret = z_aux_dll.ZAux_Direct_MoveCirc2AbsSp(self.handle, max_axis, axis_list, middle_pos1, middle_pos2,
                                                   end_pos1, end_pos2)
        if ret != 0:
            print('move_circle2_abs_sp', 'error', ret)
        return ret

    # 空间直线插补运动
    def move_smooth(self, max_axis, axis_list, end_pos1, end_pos2, end_pos3, next_pos1, next_pos2, next_pos3, radius):
        max_axis = ctypes.c_int(max_axis)
        # axis_list = ctypes.pointer(ctypes.c_int(axis_list))
        end_pos1 = ctypes.c_float(end_pos1)
        end_pos2 = ctypes.c_float(end_pos2)
        end_pos3 = ctypes.c_float(end_pos3)
        next_pos1 = ctypes.c_float(next_pos1)
        next_pos2 = ctypes.c_float(next_pos2)
        next_pos3 = ctypes.c_float(next_pos3)
        radius = ctypes.c_float(radius)
        ret = z_aux_dll.ZAux_Direct_MoveSmooth(self.handle, max_axis, axis_list, end_pos1, end_pos2, end_pos3,
                                               next_pos1, next_pos2, next_pos3, radius)
        if ret != 0:
            print('move_smooth', 'error', ret)
        return ret

    # 空间直线插补SP运动
    def move_smooth_sp(self, max_axis, axis_list, end_pos1, end_pos2, end_pos3, next_pos1, next_pos2, next_pos3,
                       radius):
        max_axis = ctypes.c_int(max_axis)
        # axis_list = ctypes.pointer(ctypes.c_int(axis_list))
        end_pos1 = ctypes.c_float(end_pos1)
        end_pos2 = ctypes.c_float(end_pos2)
        end_pos3 = ctypes.c_float(end_pos3)
        next_pos1 = ctypes.c_float(next_pos1)
        next_pos2 = ctypes.c_float(next_pos2)
        next_pos3 = ctypes.c_float(next_pos3)
        radius = ctypes.c_float(radius)
        ret = z_aux_dll.ZAux_Direct_MoveSmoothSp(self.handle, max_axis, axis_list, end_pos1, end_pos2, end_pos3,
                                                 next_pos1, next_pos2, next_pos3, radius)
        if ret != 0:
            print('move_smooth_sp', 'error', ret)
        return ret

    # 空间圆弧插补运动
    def move_spherical(self, max_axis, axis_list, end_pos1, end_pos2, end_pos3, center_pos1, center_pos2, center_pos3,
                       mode, distance4, distance5):
        max_axis = ctypes.c_int(max_axis)
        # axis_list = ctypes.pointer(ctypes.c_int(axis_list))
        end_pos1 = ctypes.c_float(end_pos1)
        end_pos2 = ctypes.c_float(end_pos2)
        end_pos3 = ctypes.c_float(end_pos3)
        center_pos1 = ctypes.c_float(center_pos1)
        center_pos2 = ctypes.c_float(center_pos2)
        center_pos3 = ctypes.c_float(center_pos3)
        mode = ctypes.c_int(mode)
        distance4 = ctypes.c_float(distance4)
        distance5 = ctypes.c_float(distance5)
        ret = z_aux_dll.ZAux_Direct_MSpherical(self.handle, max_axis, axis_list, end_pos1, end_pos2, end_pos3,
                                               center_pos1, center_pos2, center_pos3, mode, distance4, distance5)
        if ret != 0:
            print('move_spherical', 'error', ret)
        return ret

    # 空间圆弧插补SP运动
    def move_spherical_sp(self, max_axis, axis_list, end_pos1, end_pos2, end_pos3, center_pos1, center_pos2,
                          center_pos3, mode, distance4, distance5):
        max_axis = ctypes.c_int(max_axis)
        # axis_list = ctypes.pointer(ctypes.c_int(axis_list))
        end_pos1 = ctypes.c_float(end_pos1)
        end_pos2 = ctypes.c_float(end_pos2)
        end_pos3 = ctypes.c_float(end_pos3)
        center_pos1 = ctypes.c_float(center_pos1)
        center_pos2 = ctypes.c_float(center_pos2)
        center_pos3 = ctypes.c_float(center_pos3)
        mode = ctypes.c_int(mode)
        distance4 = ctypes.c_float(distance4)
        distance5 = ctypes.c_float(distance5)
        ret = z_aux_dll.ZAux_Direct_MSphericalSp(self.handle, max_axis, axis_list, end_pos1, end_pos2, end_pos3,
                                                 center_pos1, center_pos2, center_pos3, mode, distance4, distance5)
        if ret != 0:
            print('move_spherical_sp', 'error', ret)
        return ret

    # 相对圆心螺旋插补运动
    def move_helical(self, max_axis, axis_list, end_pos1, end_pos2, center_pos1, center_pos2, direction, distance3,
                     mode):
        max_axis = ctypes.c_int(max_axis)
        # axis_list = ctypes.pointer(ctypes.c_int(axis_list))
        end_pos1 = ctypes.c_float(end_pos1)
        end_pos2 = ctypes.c_float(end_pos2)
        center_pos1 = ctypes.c_float(center_pos1)
        center_pos2 = ctypes.c_float(center_pos2)
        direction = ctypes.c_int(direction)
        distance3 = ctypes.c_float(distance3)
        mode = ctypes.c_int(mode)
        ret = z_aux_dll.ZAux_Direct_MHelical(self.handle, max_axis, axis_list, end_pos1, end_pos2,
                                             center_pos1, center_pos2, direction, distance3, mode)
        if ret != 0:
            print('move_helical', 'error', ret)
        return ret

    # 相对圆心螺旋插补SP运动
    def move_helical_sp(self, max_axis, axis_list, end_pos1, end_pos2, center_pos1, center_pos2, direction, distance3,
                        mode):
        max_axis = ctypes.c_int(max_axis)
        # axis_list = ctypes.pointer(ctypes.c_int(axis_list))
        end_pos1 = ctypes.c_float(end_pos1)
        end_pos2 = ctypes.c_float(end_pos2)
        center_pos1 = ctypes.c_float(center_pos1)
        center_pos2 = ctypes.c_float(center_pos2)
        direction = ctypes.c_int(direction)
        distance3 = ctypes.c_float(distance3)
        mode = ctypes.c_int(mode)
        ret = z_aux_dll.ZAux_Direct_MHelicalSp(self.handle, max_axis, axis_list, end_pos1, end_pos2,
                                               center_pos1, center_pos2, direction, distance3, mode)
        if ret != 0:
            print('move_helical_sp', 'error', ret)
        return ret

    # 绝对圆心螺旋插补运动
    def move_helical_abs(self, max_axis, axis_list, end_pos1, end_pos2, center_pos1, center_pos2, direction, distance3,
                         mode):
        max_axis = ctypes.c_int(max_axis)
        # axis_list = ctypes.pointer(ctypes.c_int(axis_list))
        end_pos1 = ctypes.c_float(end_pos1)
        end_pos2 = ctypes.c_float(end_pos2)
        center_pos1 = ctypes.c_float(center_pos1)
        center_pos2 = ctypes.c_float(center_pos2)
        direction = ctypes.c_int(direction)
        distance3 = ctypes.c_float(distance3)
        mode = ctypes.c_int(mode)
        ret = z_aux_dll.ZAux_Direct_MHelicalAbs(self.handle, max_axis, axis_list, end_pos1, end_pos2,
                                                center_pos1, center_pos2, direction, distance3, mode)
        if ret != 0:
            print('move_helical_abs', 'error', ret)
        return ret

    # 绝对圆心螺旋插补SP运动
    def move_helical_abs_sp(self, max_axis, axis_list, end_pos1, end_pos2, center_pos1, center_pos2, direction,
                            distance3, mode):
        max_axis = ctypes.c_int(max_axis)
        # axis_list = ctypes.pointer(ctypes.c_int(axis_list))
        end_pos1 = ctypes.c_float(end_pos1)
        end_pos2 = ctypes.c_float(end_pos2)
        center_pos1 = ctypes.c_float(center_pos1)
        center_pos2 = ctypes.c_float(center_pos2)
        direction = ctypes.c_int(direction)
        distance3 = ctypes.c_float(distance3)
        mode = ctypes.c_int(mode)
        ret = z_aux_dll.ZAux_Direct_MHelicalAbsSp(self.handle, max_axis, axis_list, end_pos1, end_pos2,
                                                  center_pos1, center_pos2, direction, distance3, mode)
        if ret != 0:
            print('move_helical_abs_sp', 'error', ret)
        return ret

    # 相对三点螺旋插补运动
    def move_helical2(self, max_axis, axis_list, middle_pos1, middle_pos2, end_pos1, end_pos2, distance3, mode):
        max_axis = ctypes.c_int(max_axis)
        # axis_list = ctypes.pointer(ctypes.c_int(axis_list))
        middle_pos1 = ctypes.c_float(middle_pos1)
        middle_pos2 = ctypes.c_float(middle_pos2)
        end_pos1 = ctypes.c_float(end_pos1)
        end_pos2 = ctypes.c_float(end_pos2)
        distance3 = ctypes.c_float(distance3)
        mode = ctypes.c_int(mode)
        ret = z_aux_dll.ZAux_Direct_MHelical2(self.handle, max_axis, axis_list, middle_pos1, middle_pos2,
                                              end_pos1, end_pos2, distance3, mode)
        if ret != 0:
            print('move_helical2', 'error', ret)
        return ret

    # 相对三点螺旋插补SP运动
    def move_helical2_sp(self, max_axis, axis_list, middle_pos1, middle_pos2, end_pos1, end_pos2, distance3, mode):
        max_axis = ctypes.c_int(max_axis)
        # axis_list = ctypes.pointer(ctypes.c_int(axis_list))
        middle_pos1 = ctypes.c_float(middle_pos1)
        middle_pos2 = ctypes.c_float(middle_pos2)
        end_pos1 = ctypes.c_float(end_pos1)
        end_pos2 = ctypes.c_float(end_pos2)
        distance3 = ctypes.c_float(distance3)
        mode = ctypes.c_int(mode)
        ret = z_aux_dll.ZAux_Direct_MHelical2Sp(self.handle, max_axis, axis_list, middle_pos1, middle_pos2,
                                                end_pos1, end_pos2, distance3, mode)
        if ret != 0:
            print('move_helical2_sp', 'error', ret)
        return ret

    # 绝对三点螺旋插补运动
    def move_helical2_abs(self, max_axis, axis_list, middle_pos1, middle_pos2, end_pos1, end_pos2, distance3, mode):
        max_axis = ctypes.c_int(max_axis)
        # axis_list = ctypes.pointer(ctypes.c_int(axis_list))
        middle_pos1 = ctypes.c_float(middle_pos1)
        middle_pos2 = ctypes.c_float(middle_pos2)
        end_pos1 = ctypes.c_float(end_pos1)
        end_pos2 = ctypes.c_float(end_pos2)
        distance3 = ctypes.c_float(distance3)
        mode = ctypes.c_int(mode)
        ret = z_aux_dll.ZAux_Direct_MHelical2Abs(self.handle, max_axis, axis_list, middle_pos1, middle_pos2,
                                                 end_pos1, end_pos2, distance3, mode)
        if ret != 0:
            print('move_helical2_abs', 'error', ret)
        return ret

    # 绝对三点螺旋插补SP运动
    def move_helical2_abs_sp(self, max_axis, axis_list, middle_pos1, middle_pos2, end_pos1, end_pos2, distance3, mode):
        max_axis = ctypes.c_int(max_axis)
        # axis_list = ctypes.pointer(ctypes.c_int(axis_list))
        middle_pos1 = ctypes.c_float(middle_pos1)
        middle_pos2 = ctypes.c_float(middle_pos2)
        end_pos1 = ctypes.c_float(end_pos1)
        end_pos2 = ctypes.c_float(end_pos2)
        distance3 = ctypes.c_float(distance3)
        mode = ctypes.c_int(mode)
        ret = z_aux_dll.ZAux_Direct_MHelical2AbsSp(self.handle, max_axis, axis_list, middle_pos1, middle_pos2,
                                                   end_pos1, end_pos2, distance3, mode)
        if ret != 0:
            print('move_helical2_abs_sp', 'error', ret)
        return ret

    # 相对椭圆插补运动
    def move_ellipse(self, max_axis, axis_list, end_pos1, end_pos2, center_pos1, center_pos2, direction,
                     a_distance, b_distance):
        max_axis = ctypes.c_int(max_axis)
        # axis_list = ctypes.pointer(ctypes.c_int(axis_list))
        end_pos1 = ctypes.c_float(end_pos1)
        end_pos2 = ctypes.c_float(end_pos2)
        center_pos1 = ctypes.c_float(center_pos1)
        center_pos2 = ctypes.c_float(center_pos2)
        direction = ctypes.c_int(direction)
        a_distance = ctypes.c_float(a_distance)
        b_distance = ctypes.c_float(b_distance)
        ret = z_aux_dll.ZAux_Direct_MEclipse(self.handle, max_axis, axis_list, end_pos1, end_pos2,
                                             center_pos1, center_pos2, direction, a_distance, b_distance)
        if ret != 0:
            print('move_ellipse', 'error', ret)
        return ret

    # 相对椭圆插补SP运动
    def move_ellipse_sp(self, max_axis, axis_list, end_pos1, end_pos2, center_pos1, center_pos2, direction,
                        a_distance, b_distance):
        max_axis = ctypes.c_int(max_axis)
        # axis_list = ctypes.pointer(ctypes.c_int(axis_list))
        end_pos1 = ctypes.c_float(end_pos1)
        end_pos2 = ctypes.c_float(end_pos2)
        center_pos1 = ctypes.c_float(center_pos1)
        center_pos2 = ctypes.c_float(center_pos2)
        direction = ctypes.c_int(direction)
        a_distance = ctypes.c_float(a_distance)
        b_distance = ctypes.c_float(b_distance)
        ret = z_aux_dll.ZAux_Direct_MEclipseSp(self.handle, max_axis, axis_list, end_pos1, end_pos2,
                                               center_pos1, center_pos2, direction, a_distance, b_distance)
        if ret != 0:
            print('move_ellipse_sp', 'error', ret)
        return ret

    # 绝对椭圆插补运动
    def move_ellipse_abs(self, max_axis, axis_list, end_pos1, end_pos2, center_pos1, center_pos2, direction,
                         a_distance, b_distance):
        max_axis = ctypes.c_int(max_axis)
        # axis_list = ctypes.pointer(ctypes.c_int(axis_list))
        end_pos1 = ctypes.c_float(end_pos1)
        end_pos2 = ctypes.c_float(end_pos2)
        center_pos1 = ctypes.c_float(center_pos1)
        center_pos2 = ctypes.c_float(center_pos2)
        direction = ctypes.c_int(direction)
        a_distance = ctypes.c_float(a_distance)
        b_distance = ctypes.c_float(b_distance)
        ret = z_aux_dll.ZAux_Direct_MEclipseAbs(self.handle, max_axis, axis_list, end_pos1, end_pos2,
                                                center_pos1, center_pos2, direction, a_distance, b_distance)
        if ret != 0:
            print('move_ellipse_abs', 'error', ret)
        return ret

    # 绝对椭圆插补SP运动
    def move_ellipse_abs_sp(self, max_axis, axis_list, end_pos1, end_pos2, center_pos1, center_pos2, direction,
                            a_distance, b_distance):
        max_axis = ctypes.c_int(max_axis)
        # axis_list = ctypes.pointer(ctypes.c_int(axis_list))
        end_pos1 = ctypes.c_float(end_pos1)
        end_pos2 = ctypes.c_float(end_pos2)
        center_pos1 = ctypes.c_float(center_pos1)
        center_pos2 = ctypes.c_float(center_pos2)
        direction = ctypes.c_int(direction)
        a_distance = ctypes.c_float(a_distance)
        b_distance = ctypes.c_float(b_distance)
        ret = z_aux_dll.ZAux_Direct_MEclipseAbsSp(self.handle, max_axis, axis_list, end_pos1, end_pos2,
                                                  center_pos1, center_pos2, direction, a_distance, b_distance)
        if ret != 0:
            print('move_ellipse_abs_sp', 'error', ret)
        return ret

    # 相对螺旋椭圆插补运动
    def move_ellipse_helical(self, max_axis, axis_list, end_pos1, end_pos2, center_pos1, center_pos2, direction,
                             a_distance, b_distance, distance3):
        max_axis = ctypes.c_int(max_axis)
        # axis_list = ctypes.pointer(ctypes.c_int(axis_list))
        end_pos1 = ctypes.c_float(end_pos1)
        end_pos2 = ctypes.c_float(end_pos2)
        center_pos1 = ctypes.c_float(center_pos1)
        center_pos2 = ctypes.c_float(center_pos2)
        direction = ctypes.c_int(direction)
        a_distance = ctypes.c_float(a_distance)
        b_distance = ctypes.c_float(b_distance)
        distance3 = ctypes.c_float(distance3)
        ret = z_aux_dll.ZAux_Direct_MEclipseHelical(self.handle, max_axis, axis_list, end_pos1, end_pos2, center_pos1,
                                                    center_pos2, direction, a_distance, b_distance, distance3)
        if ret != 0:
            print('move_ellipse_helical', 'error', ret)
        return ret

    # 相对螺旋椭圆插补SP运动
    def move_ellipse_helical_sp(self, max_axis, axis_list, end_pos1, end_pos2, center_pos1, center_pos2, direction,
                                a_distance, b_distance, distance3):
        max_axis = ctypes.c_int(max_axis)
        # axis_list = ctypes.pointer(ctypes.c_int(axis_list))
        end_pos1 = ctypes.c_float(end_pos1)
        end_pos2 = ctypes.c_float(end_pos2)
        center_pos1 = ctypes.c_float(center_pos1)
        center_pos2 = ctypes.c_float(center_pos2)
        direction = ctypes.c_int(direction)
        a_distance = ctypes.c_float(a_distance)
        b_distance = ctypes.c_float(b_distance)
        distance3 = ctypes.c_float(distance3)
        ret = z_aux_dll.ZAux_Direct_MEclipseHelicalSp(self.handle, max_axis, axis_list, end_pos1, end_pos2, center_pos1,
                                                      center_pos2, direction, a_distance, b_distance, distance3)
        if ret != 0:
            print('move_ellipse_helical_sp', 'error', ret)
        return ret

    # 绝对螺旋椭圆插补运动
    def move_ellipse_helical_abs(self, max_axis, axis_list, end_pos1, end_pos2, center_pos1, center_pos2, direction,
                                 a_distance, b_distance, distance3):
        max_axis = ctypes.c_int(max_axis)
        # axis_list = ctypes.pointer(ctypes.c_int(axis_list))
        end_pos1 = ctypes.c_float(end_pos1)
        end_pos2 = ctypes.c_float(end_pos2)
        center_pos1 = ctypes.c_float(center_pos1)
        center_pos2 = ctypes.c_float(center_pos2)
        direction = ctypes.c_int(direction)
        a_distance = ctypes.c_float(a_distance)
        b_distance = ctypes.c_float(b_distance)
        distance3 = ctypes.c_float(distance3)
        ret = z_aux_dll.ZAux_Direct_MEclipseHelicalAbs(self.handle, max_axis, axis_list, end_pos1, end_pos2,
                                                       center_pos1, center_pos2, direction, a_distance, b_distance,
                                                       distance3)
        if ret != 0:
            print('move_ellipse_helical_abs', 'error', ret)
        return ret

    # 绝对螺旋椭圆插补SP运动
    def move_ellipse_helical_abs_sp(self, max_axis, axis_list, end_pos1, end_pos2, center_pos1, center_pos2, direction,
                                    a_distance, b_distance, distance3):
        max_axis = ctypes.c_int(max_axis)
        # axis_list = ctypes.pointer(ctypes.c_int(axis_list))
        end_pos1 = ctypes.c_float(end_pos1)
        end_pos2 = ctypes.c_float(end_pos2)
        center_pos1 = ctypes.c_float(center_pos1)
        center_pos2 = ctypes.c_float(center_pos2)
        direction = ctypes.c_int(direction)
        a_distance = ctypes.c_float(a_distance)
        b_distance = ctypes.c_float(b_distance)
        distance3 = ctypes.c_float(distance3)
        ret = z_aux_dll.ZAux_Direct_MEclipseHelicalAbsSp(self.handle, max_axis, axis_list, end_pos1, end_pos2,
                                                         center_pos1, center_pos2, direction, a_distance, b_distance,
                                                         distance3)
        if ret != 0:
            print('move_ellipse_helical_abs_sp', 'error', ret)
        return ret

    # 渐开线圆弧插补运动
    def move_spiral(self, max_axis, axis_list, center_pos1, center_pos2, circles, pitch, distance3, distance4):
        max_axis = ctypes.c_int(max_axis)
        # axis_list = ctypes.pointer(ctypes.c_int(axis_list))
        center_pos1 = ctypes.c_float(center_pos1)
        center_pos2 = ctypes.c_float(center_pos2)
        circles = ctypes.c_float(circles)
        pitch = ctypes.c_float(pitch)
        distance3 = ctypes.c_float(distance3)
        distance4 = ctypes.c_float(distance4)
        ret = z_aux_dll.ZAux_Direct_MoveSpiral(self.handle, max_axis, axis_list, center_pos1, center_pos2, circles,
                                               pitch, distance3, distance4)
        if ret != 0:
            print('move_spiral', 'error', ret)
        return ret

    # 渐开线圆弧插补SP运动
    def move_spiral_sp(self, max_axis, axis_list, center_pos1, center_pos2, circles, pitch, distance3, distance4):
        max_axis = ctypes.c_int(max_axis)
        # axis_list = ctypes.pointer(ctypes.c_int(axis_list))
        center_pos1 = ctypes.c_float(center_pos1)
        center_pos2 = ctypes.c_float(center_pos2)
        circles = ctypes.c_float(circles)
        pitch = ctypes.c_float(pitch)
        distance3 = ctypes.c_float(distance3)
        distance4 = ctypes.c_float(distance4)
        ret = z_aux_dll.ZAux_Direct_MoveSpiralSp(self.handle, max_axis, axis_list, center_pos1, center_pos2, circles,
                                                 pitch, distance3, distance4)
        if ret != 0:
            print('move_spiral_sp', 'error', ret)
        return ret

    # 相对旋转台直线插补运动
    def move_turn_abs(self, table_num, max_axis, axis_list, distance_list):
        table_num = ctypes.c_int(table_num)
        max_axis = ctypes.c_int(max_axis)
        # axis_list = ctypes.pointer(ctypes.c_int(axis_list))
        # distance_list = ctypes.pointer(ctypes.c_float(distance_list))
        ret = z_aux_dll.ZAux_Direct_MoveTurnabs(self.handle, table_num, max_axis, axis_list, distance_list)
        if ret != 0:
            print('move_turn_abs', 'error', ret)
        return ret

    # 相对旋转台圆弧插补运动
    def move_circle_turn_abs(self, table_num, ref_pos1, ref_pos2, mode, end_pos1, end_pos2, max_axis, axis_list,
                             distance_list):
        table_num = ctypes.c_int(table_num)
        ref_pos1 = ctypes.c_float(ref_pos1)
        ref_pos2 = ctypes.c_float(ref_pos2)
        mode = ctypes.c_int(mode)
        end_pos1 = ctypes.c_float(end_pos1)
        end_pos2 = ctypes.c_float(end_pos2)
        max_axis = ctypes.c_int(max_axis)
        # axis_list = ctypes.pointer(ctypes.c_int(axis_list))
        # distance_list = ctypes.pointer(ctypes.c_float(distance_list))
        ret = z_aux_dll.ZAux_Direct_McircTurnabs(self.handle, table_num, ref_pos1, ref_pos2, mode, end_pos1, end_pos2,
                                                 max_axis, axis_list, distance_list)
        if ret != 0:
            print('move_circle_turn_abs', 'error', ret)
        return ret

    # 运动中触发其他轴运动
    def move_async_move(self, base_axis, axis, distance, sp_whether):
        base_axis = ctypes.c_uint32(base_axis)
        axis = ctypes.c_uint32(axis)
        distance = ctypes.c_float(distance)
        sp_whether = ctypes.c_uint32(sp_whether)
        ret = z_aux_dll.ZAux_Direct_MoveASynmove(self.handle, base_axis, axis, distance, sp_whether)
        if ret != 0:
            print('move_async_move', 'error', ret)
        return ret

    # 运动中同步其他轴运动
    def move_sync_move(self, base_axis, axis, distance, sp_whether):
        base_axis = ctypes.c_uint32(base_axis)
        axis = ctypes.c_uint32(axis)
        distance = ctypes.c_float(distance)
        sp_whether = ctypes.c_uint32(sp_whether)
        ret = z_aux_dll.ZAux_Direct_MoveSynmove(self.handle, base_axis, axis, distance, sp_whether)
        if ret != 0:
            print('move_sync_move', 'error', ret)
        return ret

    # 所有轴停止运动
    def rapid_stop(self, mode):
        mode = ctypes.c_int(mode)
        ret = z_aux_dll.ZAux_Direct_Rapidstop(self.handle, mode)
        if ret != 0:
            print('rapid_stop', 'error', ret)
        return ret

    # 多个轴停止运动
    def cancel_axis_list(self, max_axis, axis_list, mode):
        max_axis = ctypes.c_int(max_axis)
        # axis_list = ctypes.pointer(ctypes.c_int(axis_list))
        mode = ctypes.c_int(mode)
        ret = z_aux_dll.ZAux_Direct_CancelAxisList(self.handle, max_axis, axis_list, mode)
        if ret != 0:
            print('cancel_axis_list', 'error', ret)
        return ret

    # 运动缓冲中操作输出口
    def move_out(self, axis, out_num, value):
        axis = ctypes.c_int(axis)
        out_num = ctypes.c_int(out_num)
        value = ctypes.c_int(value)
        ret = z_aux_dll.ZAux_Direct_MoveOp(self.handle, axis, out_num, value)
        if ret != 0:
            print('move_out', 'error', ret)
        return ret

    # 运动缓冲中操作连续输出口
    def move_out_multi(self, axis, start_out_num, end_out_num, value):
        axis = ctypes.c_int(axis)
        start_out_num = ctypes.c_int(start_out_num)
        end_out_num = ctypes.c_int(end_out_num)
        value = ctypes.c_int(value)
        ret = z_aux_dll.ZAux_Direct_MoveOpMulti(self.handle, axis, start_out_num, end_out_num, value)
        if ret != 0:
            print('move_out_multi', 'error', ret)
        return ret

    # 运动缓冲中操作输出口并定时反转
    def move_out2(self, axis, out_num, value, reverse_time):
        axis = ctypes.c_int(axis)
        out_num = ctypes.c_int(out_num)
        value = ctypes.c_int(value)
        reverse_time = ctypes.c_int(reverse_time)
        ret = z_aux_dll.ZAux_Direct_MoveOp2(self.handle, axis, out_num, value, reverse_time)
        if ret != 0:
            print('move_out2', 'error', ret)
        return ret

    # 运动缓冲中延时
    def move_delay(self, axis, time):
        axis = ctypes.c_int(axis)
        time = ctypes.c_int(time)
        ret = z_aux_dll.ZAux_Direct_MoveDelay(self.handle, axis, time)
        if ret != 0:
            print('move_delay', 'error', ret)
        return ret

    # 运动缓冲中PWM
    def move_pwm(self, base_axis, pwm_num, pwm_duty, pwm_freq):
        base_axis = ctypes.c_uint32(base_axis)
        pwm_num = ctypes.c_uint32(pwm_num)
        pwm_duty = ctypes.c_float(pwm_duty)
        pwm_freq = ctypes.c_float(pwm_freq)
        ret = z_aux_dll.ZAux_Direct_MovePwm(self.handle, base_axis, pwm_num, pwm_duty, pwm_freq)
        if ret != 0:
            print('move_pwm', 'error', ret)
        return ret

    # 运动缓冲中可变延时
    def move_wait(self, base_axis, para_name, num, mode, value):
        base_axis = ctypes.c_uint32(base_axis)
        para_name = ctypes.c_char_p(para_name.encode('utf-8'))
        num = ctypes.c_int(num)
        mode = ctypes.c_int(mode)
        value = ctypes.c_float(value)
        ret = z_aux_dll.ZAux_Direct_MoveWait(self.handle, base_axis, para_name, num, mode, value)
        if ret != 0:
            print('move_wait', 'error', ret)
        return ret

    # 运动缓冲中启动任务
    def move_task(self, base_axis, task_num, label_name):
        base_axis = ctypes.c_uint32(base_axis)
        task_num = ctypes.c_uint32(task_num)
        label_name = ctypes.c_char_p(label_name.encode('utf-8'))
        ret = z_aux_dll.ZAux_Direct_MoveTask(self.handle, base_axis, task_num, label_name)
        if ret != 0:
            print('move_task', 'error', ret)
        return ret

    # 运动缓冲中DA
    def move_da(self, axis, out_num, value):
        axis = ctypes.c_int(axis)
        out_num = ctypes.c_int(out_num)
        value = ctypes.c_float(value)
        ret = z_aux_dll.ZAux_Direct_MoveAout(self.handle, axis, out_num, value)
        if ret != 0:
            print('move_da', 'error', ret)
        return ret

    # 运动缓冲中修改TABLE
    def move_table(self, base_axis, table_num, value):
        base_axis = ctypes.c_uint32(base_axis)
        table_num = ctypes.c_uint32(table_num)
        value = ctypes.c_float(value)
        ret = z_aux_dll.ZAux_Direct_MoveTable(self.handle, base_axis, table_num, value)
        if ret != 0:
            print('move_table', 'error', ret)
        return ret

    # 运动缓冲中修改参数
    def move_para(self, base_axis, para_name, axis, value):
        base_axis = ctypes.c_uint32(base_axis)
        para_name = ctypes.c_char_p(para_name.encode('utf-8'))
        axis = ctypes.c_int(axis)
        value = ctypes.c_float(value)
        ret = z_aux_dll.ZAux_Direct_MovePara(self.handle, base_axis, para_name, axis, value)
        if ret != 0:
            print('move_para', 'error', ret)
        return ret

    # 运动缓冲中速度限制
    def move_limit(self, axis, limit_speed):
        axis = ctypes.c_int(axis)
        limit_speed = ctypes.c_float(limit_speed)
        ret = z_aux_dll.ZAux_Direct_MoveLimit(self.handle, axis, limit_speed)
        if ret != 0:
            print('move_limit', 'error', ret)
        return ret

    # 运动缓冲中修改目标位置
    def move_modify(self, axis, distance):
        axis = ctypes.c_int(axis)
        distance = ctypes.c_float(distance)
        ret = z_aux_dll.ZAux_Direct_MoveModify(self.handle, axis, distance)
        if ret != 0:
            print('move_modify', 'error', ret)
        return ret

    # 运动缓冲中暂停
    def move_pause(self, axis, mode):
        axis = ctypes.c_int(axis)
        mode = ctypes.c_int(mode)
        ret = z_aux_dll.ZAux_Direct_MovePause(self.handle, axis, mode)
        if ret != 0:
            print('move_pause', 'error', ret)
        return ret

    # 运动缓冲中恢复
    def move_resume(self, axis):
        axis = ctypes.c_int(axis)
        ret = z_aux_dll.ZAux_Direct_MoveResume(self.handle, axis)
        if ret != 0:
            print('move_resume', 'error', ret)
        return ret

    # 设置连续插补状态
    def set_merge(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.c_int(value)
        ret = z_aux_dll.ZAux_Direct_SetMerge(self.handle, axis, value)
        if ret != 0:
            print('set_merge', 'error', ret)
        return ret

    # 设置SP运动运行速度
    def set_force_speed(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.c_float(value)
        ret = z_aux_dll.ZAux_Direct_SetForceSpeed(self.handle, axis, value)
        if ret != 0:
            print('set_force_speed', 'error', ret)
        return ret

    # 设置SP运动起始速度
    def set_start_move_speed(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.c_float(value)
        ret = z_aux_dll.ZAux_Direct_SetStartMoveSpeed(self.handle, axis, value)
        if ret != 0:
            print('set_start_move_speed', 'error', ret)
        return ret

    # 设置SP运动结束速度
    def set_end_move_speed(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.c_float(value)
        ret = z_aux_dll.ZAux_Direct_SetEndMoveSpeed(self.handle, axis, value)
        if ret != 0:
            print('set_end_move_speed', 'error', ret)
        return ret

    # 设置拐角减速模式
    def set_corner_mode(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.c_int(value)
        ret = z_aux_dll.ZAux_Direct_SetCornerMode(self.handle, axis, value)
        if ret != 0:
            print('set_corner_mode', 'error', ret)
        return ret

    # 设置拐角减速起始角度
    def set_decelerate_angle(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.c_float(value)
        ret = z_aux_dll.ZAux_Direct_SetDecelAngle(self.handle, axis, value)
        if ret != 0:
            print('set_decelerate_angle', 'error', ret)
        return ret

    # 设置拐角减速停止角度
    def set_stop_angle(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.c_float(value)
        ret = z_aux_dll.ZAux_Direct_SetStopAngle(self.handle, axis, value)
        if ret != 0:
            print('set_stop_angle', 'error', ret)
        return ret

    # 设置小圆限速半径
    def set_full_sp_radius(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.c_float(value)
        ret = z_aux_dll.ZAux_Direct_SetFullSpRadius(self.handle, axis, value)
        if ret != 0:
            print('set_full_sp_radius', 'error', ret)
        return ret

    # 设置自动倒角半径
    def set_auto_smooth(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.c_float(value)
        ret = z_aux_dll.ZAux_Direct_SetZsmooth(self.handle, axis, value)
        if ret != 0:
            print('set_auto_smooth', 'error', ret)
        return ret

    # 设置运动标号
    def set_move_mark(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.c_int(value)
        ret = z_aux_dll.ZAux_Direct_SetMovemark(self.handle, axis, value)
        if ret != 0:
            print('set_move_mark', 'error', ret)
        return ret

    # 读取连续插补状态
    def get_merge(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetMerge(self.handle, axis, value)
        if ret != 0:
            print('get_merge', 'error', ret)
        return ret

    # 读取剩余运动缓冲数
    def get_remain_buffer(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetRemain_Buffer(self.handle, axis, value)
        if ret != 0:
            print('get_remain_buffer', 'error', ret)
        return ret

    # 读取SP运动运行速度
    def get_force_speed(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetForceSpeed(self.handle, axis, value)
        if ret != 0:
            print('get_force_speed', 'error', ret)
        return ret

    # 读取SP运动起始速度
    def get_start_move_speed(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetStartMoveSpeed(self.handle, axis, value)
        if ret != 0:
            print('get_start_move_speed', 'error', ret)
        return ret

    # 读取SP运动结束速度
    def get_end_move_speed(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetEndMoveSpeed(self.handle, axis, value)
        if ret != 0:
            print('get_end_move_speed', 'error', ret)
        return ret

    # 读取拐角减速模式
    def get_corner_mode(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetCornerMode(self.handle, axis, value)
        if ret != 0:
            print('get_corner_mode', 'error', ret)
        return ret

    # 读取拐角减速起始角度
    def get_decelerate_angle(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetDecelAngle(self.handle, axis, value)
        if ret != 0:
            print('get_decelerate_angle', 'error', ret)
        return ret

    # 读取拐角减速停止角度
    def get_stop_angle(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetStopAngle(self.handle, axis, value)
        if ret != 0:
            print('get_stop_angle', 'error', ret)
        return ret

    # 读取小圆限速半径
    def get_full_sp_radius(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetFullSpRadius(self.handle, axis, value)
        if ret != 0:
            print('get_full_sp_radius', 'error', ret)
        return ret

    # 读取自动倒角半径
    def get_auto_smooth(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetZsmooth(self.handle, axis, value)
        if ret != 0:
            print('get_auto_smooth', 'error', ret)
        return ret

    # # # # 数字输入输出 # # # #

    # 设置输出口状态
    def set_out(self, out_num, value):
        out_num = ctypes.c_int(out_num)
        value = ctypes.c_uint32(value)
        ret = z_aux_dll.ZAux_Direct_SetOp(self.handle, out_num, value)
        if ret != 0:
            print('set_out', 'error', ret)
        return ret

    # 设置连续输出口状态
    def set_out_multi(self, start_out_num, end_out_num, value):
        start_out_num = ctypes.c_uint16(start_out_num)
        end_out_num = ctypes.c_uint16(end_out_num)
        value = ctypes.pointer(ctypes.c_uint32(value))
        ret = z_aux_dll.ZAux_Direct_SetOutMulti(self.handle, start_out_num, end_out_num, value)
        if ret != 0:
            print('set_out_multi', 'error', ret)
        return ret

    # 读取输入口状态
    def get_in(self, in_num, value):
        in_num = ctypes.c_int(in_num)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetIn(self.handle, in_num, value)
        if ret != 0:
            print('get_in', 'error', ret)
        return ret

    # 读取输出口状态
    def get_out(self, out_num, value):
        out_num = ctypes.c_int(out_num)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetOp(self.handle, out_num, value)
        if ret != 0:
            print('get_out', 'error', ret)
        return ret

    # 快速读取连续输入口状态
    def get_modbus_in(self, start_in_num, end_in_num, value_list):
        start_in_num = ctypes.c_int(start_in_num)
        end_in_num = ctypes.c_int(end_in_num)
        value_list = ctypes.pointer(value_list)
        ret = z_aux_dll.ZAux_GetModbusIn(self.handle, start_in_num, end_in_num, value_list)
        if ret != 0:
            print('get_modbus_in', 'error', ret)
        return ret

    # 读取连续输入口状态
    def get_in_multi(self, start_in_num, end_in_num, value):
        start_in_num = ctypes.c_int(start_in_num)
        end_in_num = ctypes.c_int(end_in_num)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetInMulti(self.handle, start_in_num, end_in_num, value)
        if ret != 0:
            print('get_in_multi', 'error', ret)
        return ret

    # 读取连续输出口状态
    def get_out_multi(self, start_out_num, end_out_num, value):
        start_out_num = ctypes.c_uint16(start_out_num)
        end_out_num = ctypes.c_uint16(end_out_num)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetOutMulti(self.handle, start_out_num, end_out_num, value)
        if ret != 0:
            print('get_out_multi', 'error', ret)
        return ret

    # 快读读取连续输出口状态
    def get_modbus_out(self, start_out_num, end_out_num, value_list):
        start_out_num = ctypes.c_int(start_out_num)
        end_out_num = ctypes.c_int(end_out_num)
        value_list = ctypes.pointer(value_list)
        ret = z_aux_dll.ZAux_GetModbusOut(self.handle, start_out_num, end_out_num, value_list)
        if ret != 0:
            print('get_modbus_out', 'error', ret)
        return ret

    # # # # 编码器 # # # #

    # 读取内部编码器值
    def get_encoder(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetEncoder(self.handle, axis, value)
        if ret != 0:
            print('get_encoder', 'error', ret)
        return ret

    # 读取编码器锁存返回状态
    def get_mark(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetMark(self.handle, axis, value)
        if ret != 0:
            print('get_mark', 'error', ret)
        return ret

    # 读取编码器锁存B返回状态
    def get_mark_b(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetMarkB(self.handle, axis, value)
        if ret != 0:
            print('get_mark_b', 'error', ret)
        return ret

    # 读取反馈速度
    def get_feedback_speed(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetMspeed(self.handle, axis, value)
        if ret != 0:
            print('get_feedback_speed', 'error', ret)
        return ret

    # # # # 模拟量输入输出 # # # #

    # 设置模拟量输出口状态
    def set_da(self, da_num, value):
        da_num = ctypes.c_int(da_num)
        value = ctypes.c_float(value)
        ret = z_aux_dll.ZAux_Direct_SetDA(self.handle, da_num, value)
        if ret != 0:
            print('set_da', 'error', ret)
        return ret

    # 读取模拟量输入口状态
    def get_ad(self, ad_num, value):
        ad_num = ctypes.c_int(ad_num)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetAD(self.handle, ad_num, value)
        if ret != 0:
            print('get_ad', 'error', ret)
        return ret

    # 读取模拟量输出口状态
    def get_da(self, da_num, value):
        da_num = ctypes.c_int(da_num)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetDA(self.handle, da_num, value)
        if ret != 0:
            print('get_da', 'error', ret)
        return ret

    # # # # PWM控制 # # # #

    # 设置PWM频率
    def set_pwm_freq(self, pwm_num, value):
        pwm_num = ctypes.c_int(pwm_num)
        value = ctypes.c_float(value)
        ret = z_aux_dll.ZAux_Direct_SetPwmFreq(self.handle, pwm_num, value)
        if ret != 0:
            print('set_pwm_freq', 'error', ret)
        return ret

    # 设置PWM占空比
    def set_pwm_duty(self, pwm_num, value):
        pwm_num = ctypes.c_int(pwm_num)
        value = ctypes.c_float(value)
        ret = z_aux_dll.ZAux_Direct_SetPwmDuty(self.handle, pwm_num, value)
        if ret != 0:
            print('set_pwm_duty', 'error', ret)
        return ret

    # 读取PWM频率
    def get_pwm_freq(self, pwm_num, value):
        pwm_num = ctypes.c_int(pwm_num)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetPwmFreq(self.handle, pwm_num, value)
        if ret != 0:
            print('get_pwm_freq', 'error', ret)
        return ret

    # 读取PWM占空比
    def get_pwm_duty(self, pwm_num, value):
        pwm_num = ctypes.c_int(pwm_num)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetPwmDuty(self.handle, pwm_num, value)
        if ret != 0:
            print('get_pwm_duty', 'error', ret)
        return ret

    # # # # CAN扩展配置 # # # #

    # 设置轴地址
    def set_axis_address(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.c_int(value)
        ret = z_aux_dll.ZAux_Direct_SetAxisAddress(self.handle, axis, value)
        if ret != 0:
            print('set_axis_address', 'error', ret)
        return ret

    # 读取轴地址
    def get_axis_address(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetAxisAddress(self.handle, axis, value)
        if ret != 0:
            print('get_axis_address', 'error', ret)
        return ret

    # # # # 寄存器的数据交互 # # # #

    # 设置MODBUS位寄存器
    def set_0x(self, start, num, data):
        start = ctypes.c_uint16(start)
        num = ctypes.c_uint16(num)
        # data = ctypes.pointer(ctypes.c_uint8(data))
        ret = z_aux_dll.ZAux_Modbus_Set0x(self.handle, start, num, data)
        if ret != 0:
            print('set_0x', 'error', ret)
        return ret

    # 设置MODBUS字寄存器
    def set_4x(self, start, num, data):
        start = ctypes.c_uint16(start)
        num = ctypes.c_uint16(num)
        # data = ctypes.pointer(ctypes.c_uint16(data))
        ret = z_aux_dll.ZAux_Modbus_Set4x(self.handle, start, num, data)
        if ret != 0:
            print('set_4x', 'error', ret)
        return ret

    # 设置MODBUS_IEEE寄存器
    def set_4x_float(self, start, num, data):
        start = ctypes.c_uint16(start)
        num = ctypes.c_uint16(num)
        # data = ctypes.pointer(ctypes.c_float(data))
        ret = z_aux_dll.ZAux_Modbus_Set4x_Float(self.handle, start, num, data)
        if ret != 0:
            print('set_4x_float', 'error', ret)
        return ret

    # 设置MODBUS_LONG寄存器
    def set_4x_long(self, start, num, data):
        start = ctypes.c_uint16(start)
        num = ctypes.c_uint16(num)
        # data = ctypes.pointer(ctypes.c_int32(data))
        ret = z_aux_dll.ZAux_Modbus_Set4x_Long(self.handle, start, num, data)
        if ret != 0:
            print('set_4x_long', 'error', ret)
        return ret

    # 设置MODBUS_STRING寄存器
    def set_4x_string(self, start, num, data):
        start = ctypes.c_uint16(start)
        num = ctypes.c_uint16(num)
        data = ctypes.c_char_p(data.encode('utf-8'))
        ret = z_aux_dll.ZAux_Modbus_Set4x_String(self.handle, start, num, data)
        if ret != 0:
            print('set_4x_string', 'error', ret)
        return ret

    # 设置TABLE寄存器
    def set_table(self, start, num, value):
        start = ctypes.c_int(start)
        num = ctypes.c_int(num)
        # value = ctypes.pointer(ctypes.c_float(value))
        ret = z_aux_dll.ZAux_Direct_SetTable(self.handle, start, num, value)
        if ret != 0:
            print('set_table', 'error', ret)
        return ret

    # 设置VR寄存器
    def set_vr(self, start, num, value):
        start = ctypes.c_int(start)
        num = ctypes.c_int(num)
        # value = ctypes.pointer(ctypes.c_float(value))
        ret = z_aux_dll.ZAux_Direct_SetVrf(self.handle, start, num, value)
        if ret != 0:
            print('set_vrf', 'error', ret)
        return ret

    # 读取MODBUS位寄存器
    def get_0x(self, start, num, data):
        start = ctypes.c_uint16(start)
        num = ctypes.c_uint16(num)
        # data = ctypes.pointer(ctypes.c_uint8(data))
        ret = z_aux_dll.ZAux_Modbus_Get0x(self.handle, start, num, data)
        if ret != 0:
            print('get_0x', 'error', ret)
        return ret

    # 读取MODBUS字寄存器
    def get_4x(self, start, num, data):
        start = ctypes.c_uint16(start)
        num = ctypes.c_uint16(num)
        # data = ctypes.pointer(ctypes.c_uint16(data))
        ret = z_aux_dll.ZAux_Modbus_Get4x(self.handle, start, num, data)
        if ret != 0:
            print('get_4x', 'error', ret)
        return ret

    # 读取MODBUS_IEEE寄存器
    def get_4x_float(self, start, num, data):
        start = ctypes.c_uint16(start)
        num = ctypes.c_uint16(num)
        # data = ctypes.pointer(ctypes.c_float(data))
        ret = z_aux_dll.ZAux_Modbus_Get4x_Float(self.handle, start, num, data)
        if ret != 0:
            print('get_4x_float', 'error', ret)
        return ret

    # 读取MODBUS_LONG寄存器
    def get_4x_long(self, start, num, data):
        start = ctypes.c_uint16(start)
        num = ctypes.c_uint16(num)
        # data = ctypes.pointer(ctypes.c_int32(data))
        ret = z_aux_dll.ZAux_Modbus_Get4x_Long(self.handle, start, num, data)
        if ret != 0:
            print('get_4x_long', 'error', ret)
        return ret

    # 读取MODBUS_STRING寄存器
    def get_4x_string(self, start, num, data):
        start = ctypes.c_uint16(start)
        num = ctypes.c_uint16(num)
        data = ctypes.c_char_p(data.encode('utf-8'))
        ret = z_aux_dll.ZAux_Modbus_Get4x_String(self.handle, start, num, data)
        if ret != 0:
            print('get_4x_string', 'error', ret)
        return ret

    # 读取TABLE寄存器
    def get_table(self, start, num, value):
        start = ctypes.c_int(start)
        num = ctypes.c_int(num)
        # value = ctypes.pointer(ctypes.c_float(value))
        ret = z_aux_dll.ZAux_Direct_GetTable(self.handle, start, num, value)
        if ret != 0:
            print('get_table', 'error', ret)
        return ret

    # 读取VR_FLOAT寄存器
    def get_vr_float(self, start, num, value):
        start = ctypes.c_int(start)
        num = ctypes.c_int(num)
        # value = ctypes.pointer(ctypes.c_float(value))
        ret = z_aux_dll.ZAux_Direct_GetVrf(self.handle, start, num, value)
        if ret != 0:
            print('get_vr_float', 'error', ret)
        return ret

    # 读取VR_INT寄存器
    def get_vr_int(self, start, num, value):
        start = ctypes.c_int(start)
        num = ctypes.c_int(num)
        # value = ctypes.pointer(ctypes.c_int(value))
        ret = z_aux_dll.ZAux_Direct_GetVrInt(self.handle, start, num, value)
        if ret != 0:
            print('get_vr_int', 'error', ret)
        return ret

    # # # # FLASH及文件读写 # # # #

    # 写FLASH块
    def write_flash(self, flash_id, var_num, value):
        flash_id = ctypes.c_uint16(flash_id)
        var_num = ctypes.c_uint32(var_num)
        # value = ctypes.pointer(ctypes.c_float(value))
        ret = z_aux_dll.ZAux_FlashWritef(self.handle, flash_id, var_num, value)
        if ret != 0:
            print('write_flash', 'error', ret)
        return ret

    # 写U盘文件
    def write_u_file(self, file_name, var_list, num):
        file_name = ctypes.c_char_p(file_name.encode('utf-8'))
        # var_list = ctypes.pointer(ctypes.c_float(var_list))
        num = ctypes.c_int(num)
        ret = z_aux_dll.ZAux_WriteUFile(self.handle, file_name, var_list, num)
        if ret != 0:
            print('write_u_file', 'error', ret)
        return ret

    # 设置全局变量
    def set_user_var(self, name, value):
        name = ctypes.c_char_p(name.encode('utf-8'))
        value = ctypes.c_float(value)
        ret = z_aux_dll.ZAux_Direct_SetUserVar(self.handle, name, value)
        if ret != 0:
            print('set_user_var', 'error', ret)
        return ret

    # 设置全局数组
    def set_user_array(self, name, start, num, value):
        name = ctypes.c_char_p(name.encode('utf-8'))
        start = ctypes.c_int(start)
        num = ctypes.c_int(num)
        # value = ctypes.pointer(ctypes.c_float(value))
        ret = z_aux_dll.ZAux_Direct_SetUserArray(self.handle, name, start, num, value)
        if ret != 0:
            print('set_user_array', 'error', ret)
        return ret

    # 读FLASH块
    def read_flash(self, flash_id, var_num, value, read_num):
        flash_id = ctypes.c_uint16(flash_id)
        var_num = ctypes.c_uint32(var_num)
        # value = ctypes.pointer(ctypes.c_int(value))
        read_num = ctypes.pointer(read_num)
        ret = z_aux_dll.ZAux_FlashReadf(self.handle, flash_id, var_num, value, read_num)
        if ret != 0:
            print('read_flash', 'error', ret)
        return ret

    # 读U盘文件
    def read_u_file(self, file_name, var_list, num):
        file_name = ctypes.c_char_p(file_name.encode('utf-8'))
        # var_list = ctypes.pointer(ctypes.c_float(var_list))
        num = ctypes.pointer(ctypes.c_int(num))
        ret = z_aux_dll.ZAux_ReadUFile(self.handle, file_name, var_list, num)
        if ret != 0:
            print('read_u_file', 'error', ret)
        return ret

    # 读取全局变量
    def get_user_var(self, name, value):
        name = ctypes.c_char_p(name.encode('utf-8'))
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetUserVar(self.handle, name, value)
        if ret != 0:
            print('get_user_var', 'error', ret)
        return ret

    # 读取全局数组
    def get_user_array(self, name, start, num, value):
        name = ctypes.c_char_p(name.encode('utf-8'))
        start = ctypes.c_int(start)
        num = ctypes.c_int(num)
        # value = ctypes.pointer(ctypes.c_float(value))
        ret = z_aux_dll.ZAux_Direct_GetUserArray(self.handle, name, start, num, value)
        if ret != 0:
            print('get_user_array', 'error', ret)
        return ret

    # 读取全局FLOAT变量
    def get_var_float(self, name, value):
        name = ctypes.c_char_p(name.encode('utf-8'))
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetVariablef(self.handle, name, value)
        if ret != 0:
            print('get_var_float', 'error', ret)
        return ret

    # 读取全局INT变量
    def get_var_int(self, name, value):
        name = ctypes.c_char_p(name.encode('utf-8'))
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetVariableInt(self.handle, name, value)
        if ret != 0:
            print('get_var_int', 'error', ret)
        return ret

    # # # # 总线初始化 # # # #

    # 总线初始化
    def init_bus(self):
        ret = z_aux_dll.ZAux_BusCmd_InitBus(self.handle)
        if ret != 0:
            print('init_bus', 'error', ret)
        return ret

    # 设置错误标记
    def set_error_mask(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.c_int(value)
        ret = z_aux_dll.ZAux_Direct_SetErrormask(self.handle, axis, value)
        if ret != 0:
            print('set_error_mask', 'error', ret)
        return ret

    # 读取总线初始化状态
    def get_init_status(self, value):
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_BusCmd_GetInitStatus(self.handle, value)
        if ret != 0:
            print('get_init_status', 'error', ret)
        return ret

    # 读取错误标记
    def get_error_mask(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetErrormask(self.handle, axis, value)
        if ret != 0:
            print('get_error_mask', 'error', ret)
        return ret

    # 读取节点总线状态
    def get_node_status(self, slot, node, status):
        slot = ctypes.c_uint32(slot)
        node = ctypes.c_uint32(node)
        status = ctypes.pointer(status)
        ret = z_aux_dll.ZAux_BusCmd_GetNodeStatus(self.handle, slot, node, status)
        if ret != 0:
            print('get_node_status', 'error', ret)
        return ret

    # # # # 总线运动调用 # # # #

    # 设置轴使能状态
    def set_axis_enable(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.c_int(value)
        ret = z_aux_dll.ZAux_Direct_SetAxisEnable(self.handle, axis, value)
        if ret != 0:
            print('set_axis_enable', 'error', ret)
        return ret

    # 设置总线模拟量输出状态
    def set_dac(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.c_float(value)
        ret = z_aux_dll.ZAux_Direct_SetDAC(self.handle, axis, value)
        if ret != 0:
            print('set_dac', 'error', ret)
        return ret

    # 读取轴使能状态
    def get_axis_enable(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetAxisEnable(self.handle, axis, value)
        if ret != 0:
            print('get_axis_enable', 'error', ret)
        return ret

    # 读取总线模拟量输出状态
    def get_dac(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetDAC(self.handle, axis, value)
        if ret != 0:
            print('get_dac', 'error', ret)
        return ret

    # # # # 清除报警及信息读取 # # # #

    # 清除总线伺服报警
    def drive_clear(self, axis, mode):
        axis = ctypes.c_uint32(axis)
        mode = ctypes.c_uint32(mode)
        ret = z_aux_dll.ZAux_BusCmd_DriveClear(self.handle, axis, mode)
        if ret != 0:
            print('drive_clear', 'error', ret)
        return ret

    # 读取节点信息
    def get_node_info(self, slot, node, select, value):
        slot = ctypes.c_int(slot)
        node = ctypes.c_int(node)
        select = ctypes.c_int(select)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_BusCmd_GetNodeInfo(self.handle, slot, node, select, value)
        if ret != 0:
            print('get_node_info', 'error', ret)
        return ret

    # # # # SDO参数相关 # # # #

    # 写SDO
    def write_sdo(self, slot, node, index, sub_index, data_type, value):
        slot = ctypes.c_uint32(slot)
        node = ctypes.c_uint32(node)
        index = ctypes.c_uint32(index)
        sub_index = ctypes.c_uint32(sub_index)
        data_type = ctypes.c_uint32(data_type)
        value = ctypes.c_int32(value)
        ret = z_aux_dll.ZAux_BusCmd_SDOWrite(self.handle, slot, node, index, sub_index, data_type, value)
        if ret != 0:
            print('write_sdo', 'error', ret)
        return ret

    # 写轴SDO
    def write_axis_sdo(self, axis, index, sub_index, data_type, value):
        axis = ctypes.c_uint32(axis)
        index = ctypes.c_uint32(index)
        sub_index = ctypes.c_uint32(sub_index)
        data_type = ctypes.c_uint32(data_type)
        value = ctypes.c_int32(value)
        ret = z_aux_dll.ZAux_BusCmd_SDOWrite(self.handle, axis, index, sub_index, data_type, value)
        if ret != 0:
            print('write_axis_sdo', 'error', ret)
        return ret

    # 写realtime_express
    def write_realtime_express(self, axis, para, value):
        axis = ctypes.c_uint32(axis)
        para = ctypes.c_uint32(para)
        value = ctypes.c_float(value)
        ret = z_aux_dll.ZAux_BusCmd_RtexWrite(self.handle, axis, para, value)
        if ret != 0:
            print('write_realtime_express', 'error', ret)
        return ret

    # 读SDO
    def read_sdo(self, slot, node, index, sub_index, data_type, value):
        slot = ctypes.c_uint32(slot)
        node = ctypes.c_uint32(node)
        index = ctypes.c_uint32(index)
        sub_index = ctypes.c_uint32(sub_index)
        data_type = ctypes.c_uint32(data_type)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_BusCmd_SDORead(self.handle, slot, node, index, sub_index, data_type, value)
        if ret != 0:
            print('read_sdo', 'error', ret)
        return ret

    # 读轴SDO
    def read_axis_sdo(self, axis, index, sub_index, data_type, value):
        axis = ctypes.c_uint32(axis)
        index = ctypes.c_uint32(index)
        sub_index = ctypes.c_uint32(sub_index)
        data_type = ctypes.c_uint32(data_type)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_BusCmd_SDOReadAxis(self.handle, axis, index, sub_index, data_type, value)
        if ret != 0:
            print('read_sdo', 'error', ret)
        return ret

    # 读realtime_express
    def read_realtime_express(self, axis, para, value):
        axis = ctypes.c_uint32(axis)
        para = ctypes.c_uint32(para)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_BusCmd_RtexRead(self.handle, axis, para, value)
        if ret != 0:
            print('read_realtime_express', 'error', ret)
        return ret

    # 读取节点数量
    def get_node_num(self, slot, value):
        slot = ctypes.c_int(slot)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_BusCmd_GetNodeNum(self.handle, slot, value)
        if ret != 0:
            print('get_node_num', 'error', ret)
        return ret

    # # # # 总线转矩 # # # #

    # 设置当前总线驱动最大转矩
    def set_max_drive_torque(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.c_int(value)
        ret = z_aux_dll.ZAux_BusCmd_SetMaxDriveTorque(self.handle, axis, value)
        if ret != 0:
            print('set_max_drive_torque', 'error', ret)
        return ret

    # 读取当前总线驱动当前转矩
    def get_drive_torque(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_BusCmd_GetDriveTorque(self.handle, axis, value)
        if ret != 0:
            print('get_drive_torque', 'error', ret)
        return ret

    # 读取当前总线驱动最大转矩
    def get_max_drive_torque(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_BusCmd_GetMaxDriveTorque(self.handle, axis, value)
        if ret != 0:
            print('get_max_drive_torque', 'error', ret)
        return ret

    # # # # 驱动器回零 # # # #

    # 总线驱动器回零
    def datum(self, axis, mode):
        axis = ctypes.c_uint32(axis)
        mode = ctypes.c_uint32(mode)
        ret = z_aux_dll.ZAux_BusCmd_Datum(self.handle, axis, mode)
        if ret != 0:
            print('datum', 'error', ret)
        return ret

    # 设置回零偏移距离
    def set_datum_off_pos(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.c_float(value)
        ret = z_aux_dll.ZAux_BusCmd_SetDatumOffpos(self.handle, axis, value)
        if ret != 0:
            print('set_datum_off_pos', 'error', ret)
        return ret

    # 读取回零偏移距离
    def get_datum_off_pos(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_BusCmd_GetDatumOffpos(self.handle, axis, value)
        if ret != 0:
            print('get_datum_off_pos', 'error', ret)
        return ret

    # 读取回零完成标志
    def get_home_status(self, axis, status):
        axis = ctypes.c_uint32(axis)
        status = ctypes.pointer(status)
        ret = z_aux_dll.ZAux_BusCmd_GetHomeStatus(self.handle, axis, status)
        if ret != 0:
            print('get_home_status', 'error', ret)
        return ret

    # # # # 控制器相关 # # # #

    # 设置命令的延时等待时间
    def set_time_out(self, time):
        time = ctypes.c_uint32(time)
        ret = z_aux_dll.ZAux_SetTimeOut(self.handle, time)
        if ret != 0:
            print('set_time_out', 'error', ret)
        return ret

    # 读取控制器信息
    def get_controller_info(self, soft_type, soft_version, controller_id):
        # 需要在函数外部定义 例如 soft_type = (ctypes.c_char * 20480)(0)  20480为大小，随自己所需定
        # 再经过此函数输出后，外部参数soft_type可得到所返回的参数,但还需经过以下处理(soft_type.value).decode('utf-8')
        # soft_type = ctypes.c_char_p(soft_type.encode('utf-8'))
        # soft_version = ctypes.c_char_p(soft_version.encode('utf-8'))
        # controller_id = ctypes.c_char_p(controller_id.encode('utf-8'))
        ret = z_aux_dll.ZAux_GetControllerInfo(self.handle, soft_type, soft_version, controller_id)
        if ret != 0:
            print('get_controller_info', 'error', ret)
        return ret

    # 读取控制器最大规格数
    def get_system_specification(self, max_vir_axis, max_motor, max_io):
        max_vir_axis = ctypes.pointer(max_vir_axis)
        max_motor = ctypes.pointer(max_motor)
        max_io = ctypes.pointer(max_io)
        ret = z_aux_dll.ZAux_GetSysSpecification(self.handle, max_vir_axis, max_motor, max_io)
        if ret != 0:
            print('get_system_specification', 'error', ret)
        return ret

    # # # # 齿轮比 # # # #

    # 设置轴齿轮比
    def set_step_ratio(self, axis, pos_count, input_count):
        axis = ctypes.c_int(axis)
        pos_count = ctypes.c_int(pos_count)
        input_count = ctypes.c_int(input_count)
        ret = z_aux_dll.ZAux_Direct_StepRatio(self.handle, axis, pos_count, input_count)
        if ret != 0:
            print('set_step_ratio', 'error', ret)
        return ret

    # 设置编码器齿轮比
    def set_encoder_ratio(self, axis, pos_count, input_count):
        axis = ctypes.c_int(axis)
        pos_count = ctypes.c_int(pos_count)
        input_count = ctypes.c_int(input_count)
        ret = z_aux_dll.ZAux_Direct_EncoderRatio(self.handle, axis, pos_count, input_count)
        if ret != 0:
            print('set_encoder_ratio', 'error', ret)
        return ret

    # # # # 脉冲输出频率 # # # #

    # 设置脉冲输出最高频率
    def set_max_speed(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.c_int(value)
        ret = z_aux_dll.ZAux_Direct_SetMaxSpeed(self.handle, axis, value)
        if ret != 0:
            print('set_max_speed', 'error', ret)
        return ret

    # 读取脉冲输出最高频率
    def get_max_speed(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetMaxSpeed(self.handle, axis, value)
        if ret != 0:
            print('get_max_speed', 'error', ret)
        return ret

    # # # # 在线命令 # # # #

    # 直接发送指令全
    def execute(self, command, response, response_length):
        command = ctypes.c_char_p(command.encode('utf-8'))
        # 需要在函数外部定义 例如 response = (ctypes.c_char * 20480)(0)  20480为大小，随自己所需定
        # 再经过此函数输出后，外部参数soft_type可得到所返回的参数,但还需经过以下处理(soft_type.value).decode('utf-8')
        # response = ctypes.c_char_p(response.encode('utf-8'))
        response_length = ctypes.c_uint32(response_length)
        ret = z_aux_dll.ZAux_Execute(self.handle, command, response, response_length)
        if ret != 0:
            print('execute', 'error', ret)
        return ret

    # 直接发送指令调试
    def direct_command(self, command, response, response_length):
        command = ctypes.c_char_p(command.encode('utf-8'))
        # 需要在函数外部定义 例如 response = (ctypes.c_char * 20480)(0)  20480为大小，随自己所需定
        # 再经过此函数输出后，外部参数soft_type可得到所返回的参数,但还需经过以下处理(soft_type.value).decode('utf-8')
        # response = ctypes.c_char_p(response.encode('utf-8'))
        response_length = ctypes.c_uint32(response_length)
        ret = z_aux_dll.ZAux_DirectCommand(self.handle, command, response, response_length)
        if ret != 0:
            print('direct_command', 'error', ret)
        return ret

    # # # # 控制程序使用 # # # #

    # BAS程序下载
    def bas_down(self, file_name, run_mode):
        file_name = ctypes.c_char_p(file_name.encode('utf-8'))
        run_mode = ctypes.c_uint32(run_mode)
        ret = z_aux_dll.ZAux_BasDown(self.handle, file_name, run_mode)
        if ret != 0:
            print('bas_down', 'error', ret)
        return ret

    # BAS程序恢复运行
    def bas_resume(self):
        ret = z_aux_dll.ZAux_Resume(self.handle)
        if ret != 0:
            print('bas_resume', 'error', ret)
        return ret

    # BAS程序暂停运行
    def bas_pause(self):
        ret = z_aux_dll.ZAux_Pause(self.handle)
        if ret != 0:
            print('bas_pause', 'error', ret)
        return ret

    # # # # 电子凸轮 # # # #

    # 凸轮表运动
    def cam(self, axis, table_start, table_end, table_multi, distance):
        axis = ctypes.c_int(axis)
        table_start = ctypes.c_int(table_start)
        table_end = ctypes.c_int(table_end)
        table_multi = ctypes.c_float(table_multi)
        distance = ctypes.c_float(distance)
        ret = z_aux_dll.ZAux_Direct_Cam(self.handle, axis, table_start, table_end, table_multi, distance)
        if ret != 0:
            print('cam', 'error', ret)
        return ret

    # 跟随凸轮表运动
    def cam_box(self, axis, table_start, table_end, table_multi, distance, link_axis, option, link_pos):
        axis = ctypes.c_int(axis)
        table_start = ctypes.c_int(table_start)
        table_end = ctypes.c_int(table_end)
        table_multi = ctypes.c_float(table_multi)
        distance = ctypes.c_float(distance)
        link_axis = ctypes.c_int(link_axis)
        option = ctypes.c_int(option)
        link_pos = ctypes.c_float(link_pos)
        ret = z_aux_dll.ZAux_Direct_Cambox(self.handle, axis, table_start, table_end, table_multi, distance,
                                           link_axis, option, link_pos)
        if ret != 0:
            print('cam_box', 'error', ret)
        return ret

    # 特殊凸轮运动
    def move_link(self, axis, distance, link_dis, link_acc, link_dec, link_axis, option, link_pos):
        axis = ctypes.c_int(axis)
        distance = ctypes.c_float(distance)
        link_dis = ctypes.c_float(link_dis)
        link_acc = ctypes.c_float(link_acc)
        link_dec = ctypes.c_float(link_dec)
        link_axis = ctypes.c_int(link_axis)
        option = ctypes.c_int(option)
        link_pos = ctypes.c_float(link_pos)
        ret = z_aux_dll.ZAux_Direct_Movelink(self.handle, axis, distance, link_dis, link_acc, link_dec, link_axis,
                                             option, link_pos)
        if ret != 0:
            print('move_link', 'error', ret)
        return ret

    # 特殊凸轮同步运动
    def moves_link(self, axis, distance, link_dis, start_speed, end_speed, link_axis, option, link_pos):
        axis = ctypes.c_int(axis)
        distance = ctypes.c_float(distance)
        link_dis = ctypes.c_float(link_dis)
        start_speed = ctypes.c_float(start_speed)
        end_speed = ctypes.c_float(end_speed)
        link_axis = ctypes.c_int(link_axis)
        option = ctypes.c_int(option)
        link_pos = ctypes.c_float(link_pos)
        ret = z_aux_dll.ZAux_Direct_Moveslink(self.handle, axis, distance, link_dis, start_speed, end_speed, link_axis,
                                              option, link_pos)
        if ret != 0:
            print('moves_link', 'error', ret)
        return ret

    # # # # 高速锁存 # # # #

    # 位置锁存
    def pos_lock(self, axis, mode):
        axis = ctypes.c_int(axis)
        mode = ctypes.c_int(mode)
        ret = z_aux_dll.ZAux_Direct_Regist(self.handle, axis, mode)
        if ret != 0:
            print('pos_lock', 'error', ret)
        return ret

    # 设置锁存触发的开始坐标范围点
    def set_open_win(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.c_float(value)
        ret = z_aux_dll.ZAux_Direct_SetOpenWin(self.handle, axis, value)
        if ret != 0:
            print('set_open_win', 'error', ret)
        return ret

    # 设置锁存触发的结束坐标范围点
    def set_close_win(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.c_float(value)
        ret = z_aux_dll.ZAux_Direct_SetCloseWin(self.handle, axis, value)
        if ret != 0:
            print('set_close_win', 'error', ret)
        return ret

    # 读取锁存触发的开始坐标范围点
    def get_open_win(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetOpenWin(self.handle, axis, value)
        if ret != 0:
            print('get_open_win', 'error', ret)
        return ret

    # 读取锁存触发的结束坐标范围点
    def get_close_win(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetCloseWin(self.handle, axis, value)
        if ret != 0:
            print('get_close_win', 'error', ret)
        return ret

    # 读取锁存的测量反馈位置
    def get_reg_pos(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetRegPos(self.handle, axis, value)
        if ret != 0:
            print('get_reg_pos', 'error', ret)
        return ret

    # 读取锁存B的测量反馈位置
    def get_reg_pos_b(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetRegPosB(self.handle, axis, value)
        if ret != 0:
            print('get_reg_pos_b', 'error', ret)
        return ret

    # # # # 位置比较输出 # # # #

    # 软件位置比较输出
    def p_switch(self, comparator_num, comparator_enable, axis, out_num, out_state, start_pos, reset_pos):
        comparator_num = ctypes.c_int(comparator_num)
        comparator_enable = ctypes.c_int(comparator_enable)
        axis = ctypes.c_int(axis)
        out_num = ctypes.c_int(out_num)
        out_state = ctypes.c_int(out_state)
        start_pos = ctypes.c_float(start_pos)
        reset_pos = ctypes.c_float(reset_pos)
        ret = z_aux_dll.ZAux_Direct_Pswitch(self.handle, axis, comparator_num, comparator_enable, axis,
                                            out_num, out_state, start_pos, reset_pos)
        if ret != 0:
            print('p_switch', 'error', ret)
        return ret

    # 硬件位置比较输出
    def hw_p_switch(self, axis, mode, direction, reserve, table_start, table_end):
        axis = ctypes.c_int(axis)
        mode = ctypes.c_int(mode)
        direction = ctypes.c_int(direction)
        reserve = ctypes.c_int(reserve)
        table_start = ctypes.c_int(table_start)
        table_end = ctypes.c_int(table_end)
        ret = z_aux_dll.ZAux_Direct_HwPswitch(self.handle, axis, mode, direction, reserve, table_start, table_end)
        if ret != 0:
            print('hw_p_switch', 'error', ret)
        return ret

    # 总线硬件位置比较输出
    def hw_p_switch2(self, axis, mode, out_num, out_state, para1, para2, para3, para4):
        axis = ctypes.c_int(axis)
        mode = ctypes.c_int(mode)
        out_num = ctypes.c_int(out_num)
        out_state = ctypes.c_int(out_state)
        para1 = ctypes.c_float(para1)
        para2 = ctypes.c_float(para2)
        para3 = ctypes.c_float(para3)
        para4 = ctypes.c_float(para4)
        ret = z_aux_dll.ZAux_Direct_HwPswitch2(self.handle, axis, mode, out_num, out_state, para1, para2, para3, para4)
        if ret != 0:
            print('hw_p_switch2', 'error', ret)
        return ret

    # 硬件定时
    def hw_timer(self, mode, cycle_time, out_time, repeat_time, out_state, out_num):
        mode = ctypes.c_int(mode)
        cycle_time = ctypes.c_int(cycle_time)
        out_time = ctypes.c_int(out_time)
        repeat_time = ctypes.c_int(repeat_time)
        out_state = ctypes.c_int(out_state)
        out_num = ctypes.c_int(out_num)
        ret = z_aux_dll.ZAux_Direct_HwTimer(self.handle, mode, cycle_time, out_time, repeat_time, out_state, out_num)
        if ret != 0:
            print('hw_timer', 'error', ret)
        return ret

    # 读取硬件比较输出剩余缓冲数
    def get_hw_buffer(self, axis, value):
        axis = ctypes.c_int(axis)
        value = ctypes.pointer(value)
        ret = z_aux_dll.ZAux_Direct_GetHwPswitchBuff(self.handle, axis, value)
        if ret != 0:
            print('get_hw_buffer', 'error', ret)
        return ret

    # # # # 机械手控制 # # # #

    # 机械手逆解
    def connect_frame(self, jog_max_axis, jog_axis_list, frame_type, table_num, vir_max_axis, vir_axis_list):
        jog_max_axis = ctypes.c_int(jog_max_axis)
        jog_axis_list = ctypes.pointer(ctypes.c_int(jog_axis_list))
        frame_type = ctypes.c_int(frame_type)
        table_num = ctypes.c_int(table_num)
        vir_max_axis = ctypes.c_int(vir_max_axis)
        vir_axis_list = ctypes.pointer(ctypes.c_int(vir_axis_list))
        ret = z_aux_dll.ZAux_Direct_Connframe(self.handle, jog_max_axis, jog_axis_list, frame_type, table_num,
                                              vir_max_axis, vir_axis_list)
        if ret != 0:
            print('connect_frame', 'error', ret)
        return ret

    # 机械手正解
    def connect_reset_frame(self, vir_max_axis, vir_axis_list, frame_type, table_num, jog_max_axis, jog_axis_list):
        vir_max_axis = ctypes.c_int(vir_max_axis)
        vir_axis_list = ctypes.pointer(ctypes.c_int(vir_axis_list))
        frame_type = ctypes.c_int(frame_type)
        table_num = ctypes.c_int(table_num)
        jog_max_axis = ctypes.c_int(jog_max_axis)
        jog_axis_list = ctypes.pointer(ctypes.c_int(jog_axis_list))
        ret = z_aux_dll.ZAux_Direct_Connreframe(self.handle, vir_max_axis, vir_axis_list, frame_type, table_num,
                                                jog_max_axis, jog_axis_list)
        if ret != 0:
            print('connect_reset_frame', 'error', ret)
        return ret

    # # # # 示波器的使用 # # # #

    # 示波器触发
    def trigger(self):
        ret = z_aux_dll.ZAux_Trigger(self.handle)
        if ret != 0:
            print('trigger', 'error', ret)
        return ret

    # # # # 调试打印信息 # # # #

    # 设置命令跟踪
    def set_trace_file(self, mode, file_path_name):
        mode = ctypes.c_int(mode)
        file_path_name = ctypes.c_char_p(file_path_name.encode('utf-8'))
        ret = z_aux_dll.ZAux_SetTraceFile(self.handle, mode, file_path_name)
        if ret != 0:
            print('set_trace_file', 'error', ret)
        return ret

    # 与控制器建立连接, 可以指定连接的等待时间
    def fast_open(self, link_type, pconnectstring, uims):
        if self.handle.value is not None:
            self.close()
        link_type = ctypes.c_int(link_type)
        pconnectstring = ctypes.c_char_p(pconnectstring.encode('UTF-8'))
        uims = ctypes.c_uint32(uims)
        p_handle = ctypes.pointer(self.handle)
        ret = z_aux_dll.ZAux_FastOpen(link_type, pconnectstring, uims, p_handle)
        if ret != 0:
            print('fast_open', 'error', ret)
        return ret
