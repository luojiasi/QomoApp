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

	def __init__(self):
		q_state_file = QFile("mainweiget.ui")
		q_state_file.open(QFile.ReadOnly)
		self.ui = QUiLoader().load(q_state_file)
		q_state_file.close()
		self.ui.setFixedSize(427, 584)
		self.ui.setWindowTitle("单轴回零")
		self.ip_Scan()
		self.Init()
		self.ConnectHandle()

	def ip_Scan(self):
		self.ui.comboBox.clear()
		self.ui.comboBox.addItem("127.0.0.1")
		ipl = self.Zmc.ZAux_SearchEthlist(10230, 200)[1].value
		ipl = str(ipl.decode('utf-8'))
		print(ipl)
		self.ui.comboBox.addItems(ipl.split(" "))

	def Init(self):
		self.Zmc.handle.value = None
		self.ui.edit_com.setText("0")
		self.ui.edit_pci.setText("0")
		# Axis Paramter init
		self.ui.edit_Units.setText("1000");
		self.ui.edit_Lspeed.setText("0");
		self.ui.edit_Speed.setText("10");
		self.ui.edit_Accel.setText("100");
		self.ui.edit_Decel.setText("100");
		self.ui.edit_CLSpeed.setText("10");
		self.ui.edit_zeroIO.setText("0");
		# AxisStatue init
		self.ui.lineEdit_X.setText("停止");
		self.ui.lineEdit_Y.setText("停止");
		self.ui.lineEdit_Z.setText("停止");
		self.ui.lineEdit_R.setText("停止");
		# Axis group add and initset
		self.ui.radio_X.setChecked(True);
		self.axis_Num = 0;
		# Run Mode group add and init set
		self.ui.radioButton_m1.setChecked(True);
		self.mode = 1;

	def ConnectHandle(self):
		self.ui.btn_ip_scan.clicked.connect(self.on_btn_ip_scan_clicked)
		self.ui.btn_open.clicked.connect(self.on_btn_open_clicked)
		self.time1.timeout.connect(self.Up_State)
		self.ui.btn_close.clicked.connect(self.on_btn_close_clicked)
		self.ui.btn_clearAll.clicked.connect(self.on_btn_clearAll_clicked)
		self.ui.radio_X.clicked.connect(self.on_radio_X_clicked)
		self.ui.radio_Y.clicked.connect(self.on_radio_Y_clicked)
		self.ui.radio_Z.clicked.connect(self.on_radio_Z_clicked)
		self.ui.radio_R.clicked.connect(self.on_radio_R_clicked)
		self.ui.radioButton_m1.clicked.connect(self.on_radioButton_m1_clicked)
		self.ui.radioButton_m2.clicked.connect(self.on_radioButton_m2_clicked)
		self.ui.radioButton_m3.clicked.connect(self.on_radioButton_m3_clicked)
		self.ui.radioButton_m4.clicked.connect(self.on_radioButton_m4_clicked)
		self.ui.radioButton_m5.clicked.connect(self.on_radioButton_m5_clicked)
		self.ui.radioButton_m6.clicked.connect(self.on_radioButton_m6_clicked)
		self.ui.btn_run.clicked.connect(self.on_btn_run_clicked)
		self.ui.btn_stop.clicked.connect(self.on_btn_stop_clicked)
		self.ui.btn_clear.clicked.connect(self.on_btn_clear_clicked)
		self.ui.btn_com.clicked.connect(self.on_btn_com_clicked)
		self.ui.btn_pci.clicked.connect(self.on_btn_pci_clicked)
		self.ui.btn_local.clicked.connect(self.on_btn_local_clicked)

	def on_btn_ip_scan_clicked(self):
		self.ip_Scan()

	def Up_State(self):
		idlelist = [ctypes.c_int(-1) for i in range(0, 4)]
		fdposlist = [ctypes.c_float(0) for i in range(0, 4)]
		for i in range(0, 4):
			fdposlist[i] = self.Zmc.ZAux_Direct_GetDpos(i)[1].value  # 获取当前轴位置
			fdposlist[i] = float(fdposlist[i])

			idlelist[i] = self.Zmc.ZAux_Direct_GetIfIdle(i)[1].value  # 判断当前轴状态
			idlelist[i] = int(idlelist[i])
		str1 = " {}  {} ".format("停止中" if idlelist[0] else "运行中", round(fdposlist[0], 3))
		self.ui.lineEdit_X.setText(str1)
		str1 = " {}  {} ".format("停止中" if idlelist[1] else "运行中", round(fdposlist[1], 3))
		self.ui.lineEdit_Y.setText(str1)
		str1 = " {}  {} ".format("停止中" if idlelist[2] else "运行中", round(fdposlist[2], 3))
		self.ui.lineEdit_Z.setText(str1)
		str1 = " {}  {} ".format("停止中" if idlelist[3] else "运行中", round(fdposlist[3], 3))
		self.ui.lineEdit_R.setText(str1)

	def on_btn_open_clicked(self):
		strtemp = self.ui.comboBox.currentText()
		print("当前的ip是 ：", strtemp)
		if self.Zmc.handle.value is not None:
			self.Zmc.ZAux_Close()
			self.time1.stop()
			self.ui.setWindowTitle("单轴回零")
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
		self.ui.setWindowTitle("单轴回零")

	def on_btn_clearAll_clicked(self):
		if self.Zmc.handle.value is None:
			QMessageBox.warning(self.ui, "警告", "未连接控制器")
			return
		for i in range(0, 4):
			self.Zmc.ZAux_Direct_SetDpos(i, 0)

	def on_radio_X_clicked(self):
		self.axis_Num = 0
		print("X轴")
		self.ui.edit_zeroIO.setText("0")

	def on_radio_Y_clicked(self):
		self.axis_Num = 1
		print("Y轴")
		self.ui.edit_zeroIO.setText("1")

	def on_radio_Z_clicked(self):
		self.axis_Num = 2
		print("Y轴")
		self.ui.edit_zeroIO.setText("2")

	def on_radio_R_clicked(self):
		self.axis_Num = 3
		print("Z轴")
		self.ui.edit_zeroIO.setText("3")

	def on_radioButton_m1_clicked(self):
		self.mode = 1
		print("模式1")

	def on_radioButton_m2_clicked(self):
		self.mode = 2
		print("模式2")

	def on_radioButton_m5_clicked(self):
		self.mode = 3
		print("模式3")

	def on_radioButton_m6_clicked(self):
		self.mode = 4
		print("模式4")

	def on_radioButton_m3_clicked(self):
		self.mode = 13
		print("模式13")

	def on_radioButton_m4_clicked(self):
		self.mode = 14
		print("模式14")

	def on_btn_run_clicked(self):
		if self.Zmc.handle.value is None:
			QMessageBox.warning(self.ui, "警告", "未连接控制器")
			return
		# ifidle = ctypes.c_int(0)
		ifidle = self.Zmc.ZAux_Direct_GetIfIdle(self.axis_Num)[1].value
		ifidle = int(ifidle)
		if 0 == ifidle:
			QMessageBox.warning(self.ui, "提示", "运动未停止")
			return
		# 设定轴类型 7 - 脉冲轴类型 + 编码器Z信号 不用EZ回零也可以设置为1
		self.Zmc.ZAux_Direct_SetAtype(self.axis_Num,7 if self.mode < 3 else 1)
		# 设定脉冲模式及逻辑方向（脉冲 + 方向）
		self.Zmc.ZAux_Direct_SetInvertStep(self.axis_Num,0)
		# 设置当量
		str_tmp = self.ui.edit_Units.text()
		float_tmp = float(str_tmp)
		self.Zmc.ZAux_Direct_SetUnits(self.axis_Num,float_tmp)
		# 设置爬行速度
		str_tmp = self.ui.edit_CLSpeed.text()
		float_tmp = float(str_tmp)
		self.Zmc.ZAux_Direct_SetCreep(self.axis_Num,float_tmp)
		# 设置速度
		str_tmp = self.ui.edit_Speed.text()
		float_tmp = float(str_tmp)
		self.Zmc.ZAux_Direct_SetSpeed(self.axis_Num,float_tmp)
		# 设置加速度
		str_tmp = self.ui.edit_Accel.text()
		float_tmp = float(str_tmp)
		self.Zmc.ZAux_Direct_SetAccel(self.axis_Num,float_tmp)
		# 设置减速度
		str_tmp = self.ui.edit_Decel.text()
		float_tmp = float(str_tmp)
		self.Zmc.ZAux_Direct_SetDecel(self.axis_Num,float_tmp)
		# 设置原点开关
		str_tmp = self.ui.edit_zeroIO.text()
		float_tmp = int(str_tmp)
		self.Zmc.ZAux_Direct_SetDatumIn(self.axis_Num,float_tmp)
		# 反转 ZMC系列认为OFF时碰到了原点信号（常闭） ，如果是常开传感器则需要反转输入口，ECI系列的不需要反转
		self.Zmc.ZAux_Direct_SetInvertIn(float_tmp,1)
		# 回零
		self.Zmc.ZAux_Direct_Single_Datum(self.axis_Num,self.mode)

	def on_btn_stop_clicked(self):
		if self.Zmc.handle.value is None:
			QMessageBox.warning(self.ui,"警告","未连接控制器")
			return
		#如果已经停止则无需操作

		isidle = self.Zmc.ZAux_Direct_GetIfIdle(self.axis_Num)[1].value
		isidle = int(isidle)
		if isidle:
			return
		self.Zmc.ZAux_Direct_Single_Cancel(self.axis_Num,2)

	def on_btn_clear_clicked(self):
		if self.Zmc.handle.value is None:
			QMessageBox.warning(self.ui,"警告","未连接控制器")
			return

		isidle = self.Zmc.ZAux_Direct_GetIfIdle(self.axis_Num)[1].value
		isidle=int(isidle)
		if not isidle:
			QMessageBox.warning(self.ui,"警告","运动未暂停，不可清零")
			return
		self.Zmc.ZAux_Direct_SetDpos(self.axis_Num,0)

	def on_btn_com_clicked(self):  # 串口链接
		if self.Zmc.handle.value is not None:
			self.Zmc.ZAux_Close()
			self.Zmc.handle.value = None
			self.ui.setWindowTitle("单轴回零")
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

	def on_btn_pci_clicked(self):  				# pci链接
		if self.Zmc.handle.value is not None:
			self.Zmc.ZAux_Close()
			self.Zmc.handle.value = None
			self.ui.setWindowTitle("单轴回零")
		card_num = int(self.ui.edit_pci.text())
		iresult = self.Zmc.ZAux_OpenPci(card_num)
		if 0 != iresult:
			self.Zmc.handle.value = None
			QMessageBox.warning(self.ui, "警告", "链接失败")
			self.ui.setWindowTitle("单轴回零")
		else:
			str_title = self.ui.windowTitle() + "    已链接"
			self.ui.setWindowTitle(str_title)
			self.Up_State()
			self.time1.start(100)

	def on_btn_local_clicked(self):
		if self.Zmc.handle.value is not None:		#local接口
			self.Zmc.ZAux_Close()
			self.Zmc.handle.value = None
			self.ui.setWindowTitle("单轴回零")
		iresult = self.Zmc.ZAux_FastOpen(5, "0", 1000)
		if 0 != iresult:
			self.Zmc.handle.value = None
			QMessageBox.warning(self.ui, "警告", "链接失败")
			self.ui.setWindowTitle("单轴回零")
		else:
			str_title = self.ui.windowTitle() + "    已链接"
			self.ui.setWindowTitle(str_title)
			self.Up_State()
			self.time1.start(100)
