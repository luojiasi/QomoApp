#!/usr/bin/python
# coding:utf-8

from PySide6.QtWidgets import QMessageBox, QFileDialog
from PySide6.QtCore import QFile, QTimer
from PySide6.QtUiTools import QUiLoader

from zmcdll.zauxdllPython import ZAUXDLL
import ctypes
import os


class UiInterFace:
    Zmc = ZAUXDLL()
    time1 = QTimer()
    g_basflag = False  # BAS文件加载标志位
    g_InitStatus = 0  # 总线初始化完成状态0 - 失败 1 - 成功 - 1 - 初始化未完成
    Bus_type = ctypes.c_float(-1)  # BAS文件中变量判断总线类型，也作为BAS文件是否下载成功判断
    if_home = False
    file_Name = ""
    m_axisnum = 0

    def __init__(self):
        q_state_file = QFile("mainweiget.ui")
        q_state_file.open(QFile.ReadOnly)
        self.ui = QUiLoader().load(q_state_file)
        q_state_file.close()
        self.ui.setFixedSize(895, 590)
        self.ui.setWindowTitle("总线控制运动")
        self.ip_Scan()
        self.Init()
        self.ConnectHandle()

    def ip_Scan(self):
        self.ui.comboBox.clear()
        self.ui.comboBox.addItem("127.0.0.1")
        ipl = self.Zmc.ZAux_SearchEthlist(10230, 200)[1].value
        ipl = str(ipl.decode('utf-8'))
        # 将列表中的字符数据拼接成字符串
        iplist = ''.join(ipl)
        print(iplist)
        self.ui.comboBox.addItems(iplist.split(" "))

    def Init(self):
        self.Zmc.handle.value = None
        self.ui.edit_com.setText("0")
        self.ui.edit_pci.setText("0")
        # 初始化
        self.ui.edit_state_init.setText("未完成")
        self.ui.edit_num_node.setText("0")
        self.ui.edit_num_axis.setText("0")
        # 轴运动
        self.ui.edit_axis.setText("0")
        self.ui.edit_atype_axis.setText("0")
        self.ui.edit_state_enable.setText("off")
        self.ui.edit_units.setText("1")
        self.ui.edit_speed.setText("100")
        self.ui.edit_accle.setText("1000")
        self.ui.edit_dpos.setText("0")
        self.ui.edit_mpos.setText("0")
        self.ui.edit_state_sport.setText("-1")
        self.ui.edit_state_axis.setText("0")
        # 总线回零
        self.ui.edit_HL_mode.setText("17")
        self.ui.edit_HL_state.setText("回零未完成")
        self.ui.edit_HL_high.setText("50")
        self.ui.edit_HL_low.setText("10")
        self.ui.edit_HL_offset.setText("0")
        # EtherCAT
        self.ui.edit_node_1.setText("0")
        self.ui.edit_node_2.setText("0")
        self.ui.edit_dir_1.setText("24704")
        self.ui.edit_dir_2.setText("24704")
        self.ui.edit_sub_node_1.setText("0")
        self.ui.edit_sub_node_2.setText("0")
        self.ui.edit_date_1.setText("0")
        self.ui.edit_date_2.setText("0")

        # RTEX
        self.ui.edit_Rtex_axis_1.setText("0")
        self.ui.edit_Rtex_axis_2.setText("0")
        self.ui.edit_date_3.setText("0")
        self.ui.edit_date_4.setText("0")
        self.ui.edit_add_1.setText("0")
        self.ui.edit_add_2.setText("0")

    def ConnectHandle(self):
        self.ui.btn_ip_scan.clicked.connect(self.on_btn_ip_scan_clicked)
        self.ui.btn_open.clicked.connect(self.on_btn_open_clicked)
        self.time1.timeout.connect(self.Up_State)
        self.ui.btn_close.clicked.connect(self.on_btn_close_clicked)
        self.ui.btn_down_bas.clicked.connect(self.on_btn_down_bas_clicked)
        self.ui.btn_init_ZX.clicked.connect(self.on_btn_init_ZX_clicked)
        self.ui.edit_axis.textChanged.connect(self.on_edit_axis_textChanged)
        self.ui.btn_enable.clicked.connect(self.on_btn_enable_clicked)
        self.ui.btn_clear_warning.clicked.connect(self.on_btn_clear_warning_clicked)
        self.ui.btn_fwd.clicked.connect(self.on_btn_fwd_clicked)
        self.ui.btn_rev.clicked.connect(self.on_btn_rev_clicked)
        self.ui.btn_stop.clicked.connect(self.on_btn_stop_clicked)
        self.ui.btn_HL_start.clicked.connect(self.on_btn_HL_start_clicked)
        self.ui.btn_HL_stop.clicked.connect(self.on_btn_HL_stop_clicked)
        self.ui.btn_Ecat_read.clicked.connect(self.on_btn_Ecat_read_clicked)
        self.ui.btn_Ecat_write.clicked.connect(self.on_btn_Ecat_write_clicked)
        self.ui.btn_Rtex_read.clicked.connect(self.on_btn_Rtex_read_clicked)
        self.ui.btn_Rtex_write.clicked.connect(self.on_btn_Rtex_write_clicked)
        self.ui.btn_com.clicked.connect(self.on_btn_com_clicked)
        self.ui.btn_pci.clicked.connect(self.on_btn_pci_clicked)
        self.ui.btn_local.clicked.connect(self.on_btn_local_clicked)

    def Up_State(self):
        ret = 0
        i_AxisPara = [ctypes.c_int(-1) for i in range(0, 4)]
        f_AxisPara = [ctypes.c_float(0) for i in range(0, 4)]
        if self.Zmc.handle.value is not None:
            self.m_axisnum = int(self.ui.edit_axis.text())
            temp = self.Zmc.ZAux_Direct_GetAxisEnable(self.m_axisnum)
            ret += temp[0]
            i_AxisPara[0] = int(temp[1].value)
            temp = self.Zmc.ZAux_Direct_GetMpos(self.m_axisnum, )
            ret += temp[0]
            f_AxisPara[0] = float(temp[1].value)
            temp = self.Zmc.ZAux_Direct_GetDpos(self.m_axisnum)
            ret += temp[0]
            f_AxisPara[1] = float(temp[1].value)
            temp = self.Zmc.ZAux_Direct_GetAxisStatus(self.m_axisnum)
            ret += temp[0]
            i_AxisPara[1] = int(temp[1].value)
            temp = self.Zmc.ZAux_Direct_GetIfIdle(self.m_axisnum)
            ret += temp[0]
            i_AxisPara[2] = temp[1].value
            if ret == 0:
                self.ui.edit_state_enable.setText("off" if i_AxisPara[0] == 0 else "on")
                self.ui.edit_mpos.setText(str(round(f_AxisPara[0], 3)))
                self.ui.edit_dpos.setText(str(round(f_AxisPara[1], 3)))
                self.ui.edit_state_axis.setText(str(i_AxisPara[1]))
                self.ui.edit_state_sport.setText(str(i_AxisPara[2]))
            if ((i_AxisPara[1] & 64) == 64) and (self.if_home == False):  # 第6位是否被置1
                self.ui.edit_HL_state.setText("回零中")
                self.if_home = True
            elif (i_AxisPara[1] == 0) and self.if_home:
                homeStatus = self.Zmc.ZAux_BusCmd_GetHomeStatus(self.m_axisnum)[1].value
                homeStatus = int(homeStatus)
                self.ui.edit_HL_state.setText("回零完成" if (homeStatus == 1) else "回零未完成")
                self.if_home = False

            if (self.g_basflag and self.g_InitStatus == -1):  # 已经加载文件并且正在初始化 读取状态
                temp = self.Zmc.ZAux_Direct_GetUserVar("BUS_TYPE")  # 读取BAS文件中的变量判断总线类型
                ret += temp[0]
                self.Bus_type = temp[1].value
                #print(self.Bus_type)
                temp = self.Zmc.ZAux_Direct_GetUserVar("Bus_InitStatus")  # 读取BAS文件中的变量判断总线初始化完成状态
                ret += temp[0]
                tempstatus = temp[1]
                temp = self.Zmc.ZAux_BusCmd_GetNodeNum(0)  # 读取槽位0上节点个数。
                ret += temp[0]
                m_BusNodeNum = temp[1]
                temp = self.Zmc.ZAux_Direct_GetUserVar("Bus_TotalAxisnum")  # 读取BAS文件中的变量判断扫描的总轴数
                ret += temp[0]
                m_BusAxisNum = temp[1]
                self.g_InitStatus = int(tempstatus.value)
                if ret == 0 and self.g_InitStatus != -1:  # 初始化完成刷新状态
                    self.ui.edit_state_init.setText("初始化成功" if self.g_InitStatus == 1 else "初始化失败")
                    self.ui.edit_num_node.setText(str(m_BusNodeNum.value))
                    self.ui.edit_num_axis.setText(str(round(m_BusAxisNum.value)))

    def on_btn_ip_scan_clicked(self):
        self.ip_Scan()

    def on_btn_open_clicked(self):
        strtemp = self.ui.comboBox.currentText()
        print("当前的ip是 ：", strtemp)
        if self.Zmc.handle.value is not None:
            self.Zmc.ZAux_Close()
            self.time1.stop()
            self.ui.setWindowTitle("总线控制运动")
        iresult = self.Zmc.ZAux_OpenEth(strtemp)
        if 0 != iresult:
            QMessageBox.warning(self.ui, "提示", "连接失败")
        else:
            QMessageBox.warning(self.ui, "提示", "连接成功")
            str_title = self.ui.windowTitle() + strtemp
            self.ui.setWindowTitle(str_title)
            self.Up_State()
            self.time1.start(100)
            temp = self.Zmc.ZAux_Direct_GetUserVar("BUS_TYPE")  # 读取BAS文件中的变量判断是否有加载BAS文件
            ret = temp[0]
            self.Bus_type = temp[1]
            if ret == 0 and self.Bus_type.value != -1:
                self.g_basflag = True  # 文件已经加载

    def closeEther(self):
        if self.Zmc.handle.value is not None:
            self.Zmc.ZAux_Close()
            self.Zmc.handle.value = None
            self.time1.stop()
            print("关闭")

    def on_btn_close_clicked(self):
        self.closeEther()
        self.ui.setWindowTitle("总线控制运动")

    def on_btn_down_bas_clicked(self):  # 下载BAS文件到控制器
        if self.Zmc.handle.value is None:
            QMessageBox.warning(self.ui, "提示", "未连接控制器")
            return
        file_Date = QFileDialog.getOpenFileName(self.ui, "选择BAS文件", "..", "Files(*.bas)")
        self.file_Name = file_Date[0].replace("/", "\\")
        print(self.file_Name)
        self.ui.textEdit_file_path.insertPlainText(self.file_Name + "\n")
        temp = self.Zmc.ZAux_Direct_GetUserVar("BUS_TYPE")[1].value  # 读取BAS文件中的变量判断是否有加载BAS文件
        self.Bus_type = float(temp)
        ret = self.Zmc.ZAux_BasDown(self.file_Name, 1)  # 下载到ROM
        if ret != 0:
            QMessageBox.warning(self.ui, "提示", "文件下载失败！" + "错误码为 ：%1 ".format(ret))

    def on_btn_init_ZX_clicked(self):  # 重新初始化总线，下载ROM时程序会自动初始化一次
        if self.Zmc.handle.value is None:
            QMessageBox.warning(self.ui, "提示", "未连接控制器")
            return
        if self.g_basflag and (self.g_InitStatus != -1):  # -1可能正在执行初始化
            self.g_InitStatus = -1
            self.ui.edit_state_init.setText("初始化未完成")
            buffer = (ctypes.c_char * 1024)()
            str2 = (os.path.split(self.file_Name))[1]
            print("RUN \"{}\",4".format(str2))

            temp = self.Zmc.ZAux_Execute("STOPTASK 2")
            ret = temp[0]
            temp = self.Zmc.ZAux_Execute("RUN \"{}\",4".format(str2))  # 任务4重新运行BAS中的初始化函数
            ret += temp[0]
            temp = self.Zmc.ZAux_Direct_GetUserVar("BUS_TYPE")  # 读取BAS文件中的变量判断是否有加载BAS文件
            ret += temp[0]
            self.Bus_type = temp[1].value
            if ret == 0:
                return
        else:
            QMessageBox.warning(self.ui, "提示", "Bas文件未加载")
            return

    def on_edit_axis_textChanged(self):  # 轴被修改
        if self.Zmc.handle.value is None:
            QMessageBox.warning(self.ui, "提示", "未连接控制器")
            return
        ret = 0
        f_AxisPara = [ctypes.c_float(0) for i in range(0, 4)]
        print(len(f_AxisPara))

        self.m_axisnum = int(self.ui.edit_axis.text())
        temp = self.Zmc.ZAux_Direct_GetUnits(self.m_axisnum)
        ret += temp[0]
        f_AxisPara[0] = temp[1]
        temp = self.Zmc.ZAux_Direct_GetSpeed(self.m_axisnum)
        ret += temp[0]
        f_AxisPara[1] = temp[1]
        temp = self.Zmc.ZAux_Direct_GetAccel(self.m_axisnum)
        ret += temp[0]
        f_AxisPara[2] = temp[1]
        temp = self.Zmc.ZAux_Direct_GetAtype(self.m_axisnum)
        ret += temp[0]
        m_atype = temp[1]

        if ret == 0:
            self.ui.edit_atype_axis.setText(str(m_atype.value))
            self.ui.edit_units.setText(str(round(f_AxisPara[0].value, 3)))
            self.ui.edit_speed.setText(str(round(f_AxisPara[1].value, 3)))
            self.ui.edit_accle.setText(str(round(f_AxisPara[2].value, 3)))

    def on_btn_enable_clicked(self):  # 切换使能
        if self.Zmc.handle.value is None:
            QMessageBox.warning(self.ui, "提示", "未连接控制器")
            return
        if self.ui.edit_state_enable.text() == "on":
            self.Zmc.ZAux_Direct_SetAxisEnable(self.m_axisnum, 0)
            print("on")
        else:
            self.Zmc.ZAux_Direct_SetAxisEnable(self.m_axisnum, 1)
            print("off")

    def on_btn_clear_warning_clicked(self):  # 清除轴报警
        if self.Zmc.handle.value is None:
            QMessageBox.warning(self.ui, "提示", "未连接控制器")
            return
        ret = self.Zmc.ZAux_BusCmd_DriveClear(self.m_axisnum, 0)

    def on_btn_fwd_clicked(self):  # 正转
        if self.Zmc.handle.value is None:
            QMessageBox.warning(self.ui, "提示", "未连接控制器")
            return
        self.Zmc.ZAux_Direct_SetUnits(self.m_axisnum, float(self.ui.edit_units.text()))
        self.Zmc.ZAux_Direct_SetSpeed(self.m_axisnum, float(self.ui.edit_speed.text()))
        self.Zmc.ZAux_Direct_SetAccel(self.m_axisnum, float(self.ui.edit_accle.text()))
        self.Zmc.ZAux_Direct_Single_Vmove(self.m_axisnum, 1)

    def on_btn_rev_clicked(self):  # 反转
        if self.Zmc.handle.value is None:
            QMessageBox.warning(self.ui, "提示", "未连接控制器")
            return
        self.Zmc.ZAux_Direct_SetUnits(self.m_axisnum, float(self.ui.edit_units.text()))
        self.Zmc.ZAux_Direct_SetSpeed(self.m_axisnum, float(self.ui.edit_speed.text()))
        self.Zmc.ZAux_Direct_SetAccel(self.m_axisnum, float(self.ui.edit_accle.text()))
        self.Zmc.ZAux_Direct_Single_Vmove(self.m_axisnum, -1)

    def on_btn_stop_clicked(self):  # 停止运动
        if self.Zmc.handle.value is None:
            QMessageBox.warning(self.ui, "提示", "未连接控制器")
            return
        self.Zmc.ZAux_Direct_Single_Cancel(self.m_axisnum, 2)

    def on_btn_HL_start_clicked(self):  # 驱动器回零
        if self.Zmc.handle.value is None:
            QMessageBox.warning(self.ui, "提示", "未连接控制器")
            return
        if self.Bus_type.value == 0:
            self.Zmc.ZAux_Direct_SetSpeed(self.m_axisnum, float(self.ui.edit_HL_high.text()))
            self.Zmc.ZAux_Direct_SetCreep(self.m_axisnum, float(self.ui.edit_HL_low.text()))
            self.Zmc.ZAux_BusCmd_SetDatumOffpos(self.m_axisnum, float(self.ui.edit_HL_offset.text()))
            self.Zmc.ZAux_BusCmd_Datum(self.m_axisnum, int(self.ui.edit_HL_mode.text()))
        else:
            QMessageBox.warning(self.ui, "提示", "rtex不支持")

    def on_btn_HL_stop_clicked(self):  # 取消回零
        if self.Zmc.handle.value is None:
            QMessageBox.warning(self.ui, "提示", "未连接控制器")
            return
        self.Zmc.ZAux_Direct_Single_Cancel(self.m_axisnum, 2)

    def on_btn_Ecat_read_clicked(self):  # ETHERCAT读取
        if self.Zmc.handle.value is None:
            QMessageBox.warning(self.ui, "提示", "未连接控制器")
            return
        m_sdo_node2 = int(self.ui.edit_node_2.text())
        m_sdo_index2 = int(self.ui.edit_dir_2.text())
        m_sdo_sub2 = int(self.ui.edit_sub_node_2.text())
        m_sdo_type2 = self.ui.comboBox_type_2.currentIndex() + 1
        m_sdo_data2 = ctypes.c_int(0)
        print(self.Bus_type)
        if self.Bus_type == 0:
            ret = self.Zmc.ZAux_BusCmd_SDORead(0, m_sdo_node2, m_sdo_index2, m_sdo_sub2, m_sdo_type2)
            m_sdo_data2 = int(ret[1].value)
            if ret != 0:
                QMessageBox.warning(self.ui, "提示", "读取失败")
                return
            self.ui.edit_date_2.setText(str(m_sdo_data2))
        else:
            QMessageBox.warning(self.ui, "提示", "非ETHERCAT模块")
            return

    def on_btn_Ecat_write_clicked(self):  # ETHERCAT写
        if self.Zmc.handle.value is None:
            QMessageBox.warning(self.ui, "提示", "未连接控制器")
            return
        m_sdo_node1 = int(self.ui.edit_node_1.text())
        m_sdo_index1 = int(self.ui.edit_dir_1.text())
        m_sdo_sub1 = int(self.ui.edit_sub_node_1.text())
        m_sdo_type1 = self.ui.comboBox_type_1.currentIndex() + 1
        m_sdo_data1 = int(self.ui.edit_date_1.text())
        if self.Bus_type == 0:
            ret = self.Zmc.ZAux_BusCmd_SDOWrite(0, m_sdo_node1, m_sdo_index1, m_sdo_sub1, m_sdo_type1, m_sdo_data1)
            if ret != 0:
                QMessageBox.warning(self.ui, "提示", "写入失败")
                return
        else:
            QMessageBox.warning(self.ui, "提示", "非ETHERCAT模块")
            return

    def on_btn_Rtex_read_clicked(self):  # RTEX读取
        if self.Zmc.handle.value is None:
            QMessageBox.warning(self.ui, "提示", "未连接控制器")
            return
        m_rtex_axis1 = int(self.ui.edit_Rtex_axis_2.text())
        m_rtex_para1 = int(self.ui.edit_add_2.text())
        if self.Bus_type == 1:
            tem = self.Zmc.ZAux_BusCmd_RtexRead(m_rtex_axis1, m_rtex_para1)
            m_rtex_data1 = tem[1].value
            ret = tem[0]
            if ret != 0:
                QMessageBox.warning(self.ui, "提示", "读取失败")
                return
            self.ui.edit_date_4.setText(str(round(m_rtex_data1, 3)))
        else:
            QMessageBox.warning(self.ui, "提示", "非RTEX模块")
            return

    def on_btn_Rtex_write_clicked(self):  # RTEX写
        if self.Zmc.handle.value is None:
            QMessageBox.warning(self.ui, "提示", "未连接控制器")
            return
        m_rtex_axis0 = int(self.ui.edit_Rtex_axis_1.text())
        m_rtex_para0 = int(self.ui.edit_add_1.text())
        m_rtex_data0 = float(self.ui.edit_date_3.text())
        if self.Bus_type.value == 1:
            ret = self.Zmc.ZAux_BusCmd_RtexWrite(-m_rtex_axis0, m_rtex_para0, m_rtex_data0)
            if ret != 0:
                QMessageBox.warning(self.ui, "提示", "写入失败")
                return
        else:
            QMessageBox.warning(self.ui, "提示", "非RTEX模块")
            return

    def on_btn_com_clicked(self):  # 串口链接
        if self.Zmc.handle.value is not None:
            self.Zmc.ZAux_Close()
            self.Zmc.handle.value = None
            self.ui.setWindowTitle("总线控制运动")
        icomid = int(self.ui.edit_com.text())
        iresult = self.Zmc.ZAux_OpenCom(icomid)
        if 0 != iresult:
            self.Zmc.handle.value = None
            QMessageBox.warning(self.ui, "警告", "链接失败")
        else:
            str_title = self.ui.windowTitle() + "    已链接"
            self.ui.setWindowTitle(str_title)
            self.Up_State()
            self.time1.start(100)

    def on_btn_pci_clicked(self):  # pci链接
        if self.Zmc.handle.value is not None:
            self.Zmc.ZAux_Close()
            self.Zmc.handle.value = None
            self.ui.setWindowTitle("总线控制运动")
        card_num = int(self.ui.edit_pci.text())
        iresult = self.Zmc.ZAux_OpenPci(card_num)
        if 0 != iresult:
            self.Zmc.handle.value = None
            QMessageBox.warning(self.ui, "警告", "链接失败")
            self.ui.setWindowTitle("总线控制运动")
        else:
            str_title = self.ui.windowTitle() + "    已链接"
            self.ui.setWindowTitle(str_title)
            self.Up_State()
            self.time1.start(100)

    def on_btn_local_clicked(self):
        if self.Zmc.handle.value is not None:
            self.Zmc.ZAux_Close()
            self.Zmc.handle.value = None
            self.ui.setWindowTitle("总线控制运动")
        iresult = self.Zmc.ZAux_FastOpen(5, "0", 1000)
        if 0 != iresult:
            self.Zmc.handle.value = None
            QMessageBox.warning(self.ui, "警告", "链接失败")
            self.ui.setWindowTitle("总线控制运动")
        else:
            str_title = self.ui.windowTitle() + "    已链接"
            self.ui.setWindowTitle(str_title)
            self.Up_State()
            self.time1.start(100)
