#!/usr/bin/python
# coding:utf-8

from PySide6.QtWidgets import QMessageBox
from PySide6.QtCore import QFile, QTimer
from PySide6.QtUiTools import QUiLoader

from zmcdll.zauxdllPython import ZAUXDLL
import ctypes


class UiInterFace:
    Zmc = ZAUXDLL()
    time1 = QTimer()
    axis_State = 0
    axis_Num = 0
    mode = 0
    direction = 1

    def __init__(self):
        q_state_file = QFile("mainweiget.ui")
        q_state_file.open(QFile.ReadOnly)
        self.ui = QUiLoader().load(q_state_file)
        q_state_file.close()
        self.ui.setFixedSize(405, 565)
        self.ui.setWindowTitle("单轴运动")


        
        self.ip_Scan()
        self.Init()
        self.ConnectHandle()


    def Init(self):
        self.Zmc.handle.value = None
        self.ui.edit_com.setText("0")
        self.ui.edit_pci.setText("0")
        # Axis Paramter init
        self.ui.edit_Units.setText("1000")
        self.ui.edit_Lspeed.setText("0")
        self.ui.edit_Speed.setText("10")
        self.ui.edit_Accel.setText("100")
        self.ui.edit_Decel.setText("100")
        self.ui.edit_Sramp.setText("20")
        self.ui.edit_Distance.setText("10")
        # AxisStatue init
        self.ui.edit_State.setText("停止")
        self.ui.edit_Dpos.setText("0")
        self.ui.edit_Vspeed.setText("0")
        # Axis group add and init set
        self.ui.radio_X.setChecked(True)
        # Run Mode group add and init set
        self.ui.radio_Vmove.setChecked(True)
        self.ui.radio_Zheng.setChecked(True)

    def ConnectHandle(self):
        self.ui.btn_ip_scan.clicked.connect(self.on_btn_ip_scan_clicked)
        self.ui.btn_open.clicked.connect(self.on_btn_open_clicked)
        self.time1.timeout.connect(self.Up_State)
        self.ui.btn_close.clicked.connect(self.on_btn_close_clicked)
        self.ui.radio_Zheng.clicked.connect(self.on_radio_Zheng_clicked)
        self.ui.radio_fu.clicked.connect(self.on_radio_fu_clicked)
        self.ui.radio_Vmove.clicked.connect(self.on_radio_Vmove_clicked)
        self.ui.radio_MoveAbs.clicked.connect(self.on_radio_MoveAbs_clicked)
        self.ui.btn_Run.clicked.connect(self.on_btn_Run_clicked)
        self.ui.btn_Stop.clicked.connect(self.on_btn_Stop_clicked)
        self.ui.btn_Clear.clicked.connect(self.on_btn_Clear_clicked)
        self.ui.radio_X.clicked.connect(self.on_radio_X_clicked)
        self.ui.radio_Y.clicked.connect(self.on_radio_Y_clicked)
        self.ui.radio_Z.clicked.connect(self.on_radio_Z_clicked)
        self.ui.radio_R.clicked.connect(self.on_radio_R_clicked)
        self.ui.btn_com.clicked.connect(self.on_btn_com_clicked)
        self.ui.btn_pci.clicked.connect(self.on_btn_pci_clicked)
        self.ui.btn_local.clicked.connect(self.on_btn_local_clicked)

    def on_btn_ip_scan_clicked(self):
        self.ip_Scan()

    def ip_Scan(self):
        self.ui.comboBox.clear()
        self.ui.comboBox.addItem("127.0.0.1")
        ipl = self.Zmc.ZAux_SearchEthlist(10230, 200)[1].value
        ipl = str(ipl.decode('utf-8'))
        print(ipl)
        self.ui.comboBox.addItems(ipl.split(" "))


    def Up_State(self):

        idle = self.Zmc.ZAux_Direct_GetIfIdle(self.axis_Num)[1].value
        str_tmp = "停止" if idle else "运行"
        self.ui.edit_State.setText(str_tmp)
        # 位置
        fdpos = self.Zmc.ZAux_Direct_GetDpos(self.axis_Num)[1].value
        fdpos = float(round(fdpos, 3))
        str_tmp = str(fdpos)
        self.ui.edit_Dpos.setText(str_tmp)
        # 速度
        fvspeed= self.Zmc.ZAux_Direct_GetSpeed(self.axis_Num)[1].value
        fvspeed = float(round(fvspeed, 3))
        str_tmp = str(fvspeed)
        self.ui.edit_Vspeed.setText(str_tmp)

    def on_btn_open_clicked(self):
        strtemp = self.ui.comboBox.currentText()
        print("当前的ip是 ：", strtemp)
        if self.Zmc.handle.value is not None:
            self.Zmc.ZAux_Close()
            self.time1.stop()
            self.ui.setWindowTitle("单轴运动")
        iresult = self.Zmc.ZAux_OpenEth(strtemp)
        if 0 != iresult:
            QMessageBox.warning(self.ui, "提示", "连接失败")
        else:
            QMessageBox.warning(self.ui, "提示", "连接成功")
            str_title = self.ui.windowTitle() + strtemp
            self.ui.setWindowTitle(str_title)
            self.Up_State()
            self.time1.start(100)

    def closeEther(self):
        if self.Zmc.handle.value is not None:
            self.Zmc.ZAux_Close()
            self.Zmc.handle.value = None
            self.time1.stop()
            print("关闭")

    def on_btn_close_clicked(self):
        self.closeEther()
        self.ui.setWindowTitle("单轴运动")

    def on_radio_Zheng_clicked(self):
        self.direction = 1
        print("正向运动")

    def on_radio_fu_clicked(self):
        self.direction = -1
        print("负向运动")

    def on_radio_Vmove_clicked(self):
        self.mode = 0
        print("持续运动")

    def on_radio_MoveAbs_clicked(self):
        self.mode = 1
        print("绝对运动")

    def on_radio_X_clicked(self):
        self.axis_Num = 0
        print(self.axis_Num)
        print("X轴")

    def on_radio_Y_clicked(self):
        self.axis_Num = 1
        print(self.axis_Num)
        print("Y轴")

    def on_radio_Z_clicked(self):
        self.axis_Num = 2
        print(self.axis_Num)
        print("Z轴")

    def on_radio_R_clicked(self):
        self.axis_Num = 3
        print(self.axis_Num)
        print("R轴")

    def on_btn_Run_clicked(self):
        if self.Zmc.handle.value is None:
            QMessageBox.warning(self.ui, "警告", "未连接控制器")
            return
        isidle=self.Zmc.ZAux_Direct_GetIfIdle(self.axis_Num)[1].value
        isidle=int(isidle)
        if self.mode == 1 and not isidle:
            QMessageBox.warning(self.ui, "警告", "未停止")
            return
        # 设置当量
        str_tmp = self.ui.edit_Units.text()
        float_tmp = float(str_tmp)
        self.Zmc.ZAux_Direct_SetUnits(self.axis_Num, float_tmp)
        # 设置速度
        str_tmp = self.ui.edit_Speed.text()
        float_tmp = float(str_tmp)
        self.Zmc.ZAux_Direct_SetSpeed(self.axis_Num, float_tmp)
        # 设置加速度
        str_tmp = self.ui.edit_Accel.text()
        float_tmp = float(str_tmp)
        self.Zmc.ZAux_Direct_SetAccel(self.axis_Num, float_tmp)
        # 设置减速度
        str_tmp = self.ui.edit_Decel.text()
        float_tmp = float(str_tmp)
        self.Zmc.ZAux_Direct_SetDecel(self.axis_Num, float_tmp)
        # 设置S曲线
        str_tmp = self.ui.edit_Sramp.text()
        float_tmp = float(str_tmp)
        self.Zmc.ZAux_Direct_SetSramp(self.axis_Num, float_tmp)
        if 0 == self.mode:
            self.Zmc.ZAux_Direct_Single_Vmove(self.axis_Num, self.direction)
        elif 1 == self.mode:
            str_tmp = self.ui.edit_Distance.text()
            float_tmp = float(str_tmp)
            self.Zmc.ZAux_Direct_Single_Move(self.axis_Num, -float_tmp if self.direction == -1 else float_tmp)

    def on_btn_Stop_clicked(self):

        if self.Zmc.handle.value is None:
            QMessageBox.warning(self.ui, "警告", "未连接控制器")
            return
        isidle=self.Zmc.ZAux_Direct_GetIfIdle(self.axis_Num)[1].value

        if isidle:
            QMessageBox.warning(self.ui, "警告", "已停止")
            return
        self.Zmc.ZAux_Direct_Single_Cancel(self.axis_Num, 2)

    def on_btn_Clear_clicked(self):
        if self.Zmc.handle.value is None:
            QMessageBox.warning(self.ui, "警告", "未连接控制器")
            return

        isidle=self.Zmc.ZAux_Direct_GetIfIdle(self.axis_Num)[1]
        if not isidle:
            QMessageBox.warning(self.ui, "警告", "未停止")
            return
        self.Zmc.ZAux_Direct_SetDpos(self.axis_Num, 0)

    def on_btn_com_clicked(self):  # 串口链接
        if self.Zmc.handle.value is not None:
            self.Zmc.ZAux_Close()
            self.Zmc.handle.value = None
            self.ui.setWindowTitle("单轴运动")
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
            self.ui.setWindowTitle("单轴运动")
        card_num = int(self.ui.edit_pci.text())
        iresult = self.Zmc.ZAux_OpenPci(card_num)
        if 0 != iresult:
            self.Zmc.handle.value = None
            QMessageBox.warning(self.ui, "警告", "链接失败")
            self.ui.setWindowTitle("单轴运动")
        else:
            str_title = self.ui.windowTitle() + "    已链接"
            self.ui.setWindowTitle(str_title)
            self.Up_State()
            self.time1.start(100)

    def on_btn_local_clicked(self):
        if self.Zmc.handle.value is not None:
            self.Zmc.ZAux_Close()
            self.Zmc.handle.value = None
            self.ui.setWindowTitle("单轴运动")
        iresult = self.Zmc.ZAux_FastOpen(5, "0", 1000)
        if 0 != iresult:
            self.Zmc.handle.value = None
            QMessageBox.warning(self.ui, "警告", "链接失败")
            self.ui.setWindowTitle("单轴运动")
        else:
            str_title = self.ui.windowTitle() + "    已链接"
            self.ui.setWindowTitle(str_title)
            self.Up_State()
            self.time1.start(100)
