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
	mode = 0
	type = 0

	def __init__(self):

		q_state_file = QFile("mainweiget.ui")
		q_state_file.open(QFile.ReadOnly)
		self.ui = QUiLoader().load(q_state_file)
		q_state_file.close()
		self.ui.setFixedSize(433, 556)
		self.ui.setWindowTitle("直线圆弧插补运动")
		self.ip_Scan()
		self.Init()
		self.ConnectHandle()

	def ip_Scan(self):
		self.ui.comboBox.clear()
		self.ui.comboBox.addItem("127.0.0.1")
		ipl = self.Zmc.ZAux_SearchEthlist(10230, 200)[1].value
		ipl = str(ipl.decode('utf-8'))
		iplist = ''.join(ipl)
		print(iplist)
		self.ui.comboBox.addItems(iplist.split(" "))

	def Init(self):
		self.Zmc.handle.value = None
		self.ui.edit_com.setText("0")
		self.ui.edit_pci.setText("0")
		# Axis Paramter init
		self.ui.lineEdit_Units.setText("100")
		self.ui.lineEdit_Speed.setText("100")
		self.ui.lineEdit_Accel.setText("1000")
		self.ui.lineEdit_Decel.setText("1000")
		# AxisStatue init
		self.ui.edit_stateRun_2.setText("停止")
		self.ui.edit_stateX_2.setText("0")
		self.ui.edit_stateY_2.setText("0")
		self.ui.edit_stateZ_2.setText("0")
		self.ui.edit_stateU_2.setText("0")
		# 终点初始化
		self.ui.edit_finishX.setText("100")
		self.ui.edit_finishY.setText("100")
		self.ui.edit_finishZ.setText("100")
		self.ui.edit_finishU.setText("100")
		# 中点初始化
		self.ui.edit_midX.setText("100")
		self.ui.edit_midY.setText("200")
		self.ui.edit_midZ.setText("300")
		self.ui.edit_midU.setText("400")

		# 运动模式初始化
		self.ui.radioButton_Abs.setChecked(True)
		self.mode = 0
		# Run Mode group add and init set
		self.ui.radioButton_xy.setChecked(True)
		self.type = 0

	def ConnectHandle(self):
		self.ui.btn_ip_scan.clicked.connect(self.on_btn_ip_scan_clicked)
		self.ui.btn_open.clicked.connect(self.on_btn_open_clicked)
		self.time1.timeout.connect(self.Up_State)
		self.ui.btn_close.clicked.connect(self.on_btn_close_clicked)
		self.ui.radioButton_Abs.clicked.connect(self.on_radioButton_Abs_clicked)
		self.ui.radioButton_XD.clicked.connect(self.on_radioButton_XD_clicked)
		self.ui.radioButton_xy.clicked.connect(self.on_radioButton_xy_clicked)
		self.ui.radioButton_xy3.clicked.connect(self.on_radioButton_xy3_clicked)
		self.ui.radioButton_xyzu.clicked.connect(self.on_radioButton_xyzu_clicked)
		self.ui.radioButton_xyz_u.clicked.connect(self.on_radioButton_xyz_u_clicked)
		self.ui.btn_Run.clicked.connect(self.on_btn_Run_clicked)
		self.ui.btn_Stop.clicked.connect(self.on_btn_Stop_clicked)
		self.ui.btn_Clear.clicked.connect(self.on_btn_Clear_clicked)
		self.ui.btn_com.clicked.connect(self.on_btn_com_clicked)
		self.ui.btn_pci.clicked.connect(self.on_btn_pci_clicked)
		self.ui.btn_local.clicked.connect(self.on_btn_local_clicked)


	def on_btn_ip_scan_clicked(self):
		self.ip_Scan()

	def Up_State(self):
		if self.Zmc.handle.value is None:
			self.ui.edit_stateRun_2.setText("停止")
			return

		Dpos=self.Zmc.ZAux_Direct_GetDpos(0)[1].value
		Dpos=float(Dpos)
		pos = str(round(Dpos, 2))
		self.ui.edit_stateX_2.setText(pos)

		Dpos=self.Zmc.ZAux_Direct_GetDpos(1)[1].value
		Dpos = float(Dpos)
		pos = str(round(Dpos, 2))
		self.ui.edit_stateY_2.setText(pos)

		Dpos=self.Zmc.ZAux_Direct_GetDpos(2)[1].value
		Dpos = float(Dpos)
		pos = str(round(Dpos, 2))
		self.ui.edit_stateZ_2.setText(pos)

		Dpos=self.Zmc.ZAux_Direct_GetDpos(3)[1].value
		Dpos = float(Dpos)
		pos = str(round(Dpos, 2))
		self.ui.edit_stateU_2.setText(pos)


		ifidle = self.Zmc.ZAux_Direct_GetIfIdle(0)[1].value
		ifidle=int(ifidle)
		self.ui.edit_stateRun_2.setText("停止" if ifidle else "运动中")

	def on_btn_open_clicked(self):
		strtemp = self.ui.comboBox.currentText()
		print("当前的ip是 ：", strtemp)
		if self.Zmc.handle.value is not None:
			self.Zmc.ZAux_Close()
			self.time1.stop()
			self.ui.setWindowTitle("直线圆弧插补运动")
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
		self.ui.setWindowTitle("直线圆弧插补运动")

	def on_radioButton_Abs_clicked(self):
		self.mode = 0
		print(self.mode)

	def on_radioButton_XD_clicked(self):
		self.mode = 1
		print(self.mode)

	def on_radioButton_xy_clicked(self):
		self.type = 0
		print(self.type)

	def on_radioButton_xy3_clicked(self):
		self.type = 1
		print(self.type)

	def on_radioButton_xyzu_clicked(self):
		self.type = 2
		print(self.type)

	def on_radioButton_xyz_u_clicked(self):
		self.type = 3
		print(self.type)

	def on_btn_Run_clicked(self):
		if self.Zmc.handle.value is None:
			QMessageBox.warning(self.ui, "警告", "未连接控制器")
			return
		print(self.Zmc.handle)
		isidle=self.Zmc.ZAux_Direct_GetIfIdle(0)[1].value
		isidle=int(isidle)
		if not isidle:
			QMessageBox.warning(self.ui, "警告", "未停止")
			return


		# 轴列表，base

		axislist = (ctypes.c_int * 4)(0, 1, 2, 3)
		print(axislist[0], type(axislist[0]))
		self.Zmc.ZAux_Direct_Base(4, axislist)
		# 设置当量
		str_tmp = self.ui.lineEdit_Units.text()
		float_tmp = float(str_tmp)
		self.Zmc.ZAux_Direct_SetUnits(0, float_tmp)
		# 设置速度
		str_tmp = self.ui.lineEdit_Speed.text()
		float_tmp = float(str_tmp)
		self.Zmc.ZAux_Direct_SetSpeed(0, float_tmp)
		# 设置加速度
		str_tmp = self.ui.lineEdit_Accel.text()
		float_tmp = float(str_tmp)
		self.Zmc.ZAux_Direct_SetAccel(0, float_tmp)
		# 设置减速度
		str_tmp = self.ui.lineEdit_Decel.text()
		float_tmp = float(str_tmp)
		self.Zmc.ZAux_Direct_SetDecel(0, float_tmp)

		# 自动触发示波器
		self.Zmc.ZAux_Trigger()
		# 终点列表
		poslist = (ctypes.c_float * 4)(
			float(self.ui.edit_finishX.text()), float(self.ui.edit_finishY.text()),
			float(self.ui.edit_finishZ.text()), float(self.ui.edit_finishU.text()))
		# 圆弧中间点
		midlist = (ctypes.c_float * 4)(
			float(self.ui.edit_midX.text()), float(self.ui.edit_midY.text()),
			float(self.ui.edit_midZ.text()), float(self.ui.edit_midU.text()))
		# 用于相对绝对转换
		endmove = [ctypes.c_float(0) for i in range(0,4)]

		if self.mode == 0:  # 绝对运动
			if self.type == 0:
				print("XY直线插补")
				self.Zmc.ZAux_Direct_MoveAbsSp(2, axislist, poslist)

			elif self.type == 1:
				print("XY3点圆弧")
				self.Zmc.ZAux_Direct_MoveCirc2Abs(2, axislist, midlist[0], midlist[1], poslist[0], poslist[1])
			elif self.type == 2:
				print("XYZU直线插补")
				self.Zmc.ZAux_Direct_MoveAbsSp(4, axislist, poslist)
			elif self.type == 3:
				print("XYZ空间圆弧插补U螺旋")
				# 此命令没有绝对运动，需转换为相对运动
				for i in range(0, 4):
					endmove[i] = self.Zmc.ZAux_Direct_GetEndMoveBuffer(i)[1].value
					poslist[i] = poslist[i] - endmove[i]
					midlist[i] = midlist[i] - endmove[i]
					self.Zmc.ZAux_Direct_MSpherical(4, axislist, poslist[0], poslist[1], poslist[2], midlist[0], midlist[1],
											midlist[2], 0, poslist[3], 0)
		elif self.mode == 1:
			if self.type == 0:
				print("XY直线插补")
				self.Zmc.ZAux_Direct_Move(2, axislist, poslist)
			elif self.type == 1:
				print("XY3点圆弧")
				self.Zmc.ZAux_Direct_MoveCirc2(2, axislist, midlist[0], midlist[1], poslist[0], poslist[1])
			elif self.type == 2:
				print("XYZU直线插补")
				self.Zmc.ZAux_Direct_Move(4, axislist, poslist)
			elif self.type == 3:
				print("XYZ空间圆弧插补U螺旋")
				self.Zmc.ZAux_Direct_MSpherical(4, axislist, poslist[0], poslist[1], poslist[2], midlist[0], midlist[1],
										midlist[2], 0, poslist[3], 0)

	def on_btn_Stop_clicked(self):
		if self.Zmc.handle.value is None:
			QMessageBox.warning(self.ui, "警告", "未连接控制器")
			return
		# 停止主轴即可
		isidle=self.Zmc.ZAux_Direct_GetIfIdle(0)[1].value
		isidle=int(isidle)
		if isidle == -1:
			return
		self.Zmc.ZAux_Direct_Single_Cancel(0, 2)

	def on_btn_Clear_clicked(self):
		if self.Zmc.handle.value is None:
			QMessageBox.warning(self.ui, "警告", "未连接控制器")
			return
		for i in range(0, 4):
			self.Zmc.ZAux_Direct_SetDpos(i, 0)  # DPOS清零

	def on_btn_com_clicked(self):  						# 串口链接
		if self.Zmc.handle.value is not None:
			self.Zmc.ZAux_Close()
			self.Zmc.handle.value = None
			self.ui.setWindowTitle("直线圆弧插补运动")
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
			self.ui.setWindowTitle("直线圆弧插补运动")
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
		if self.Zmc.handle.value is not None:		#local接口
			self.Zmc.ZAux_Close()
			self.Zmc.handle.value = None
			self.ui.setWindowTitle("直线圆弧插补运动")
		iresult = self.Zmc.ZAux_FastOpen(5, "0", 1000)
		if 0 != iresult:
			self.Zmc.handle.value = None
			QMessageBox.warning(self.ui, "警告", "链接失败")
			self.ui.setWindowTitle("直线圆弧插补运动")
		else:
			str_title = self.ui.windowTitle() + "    已链接"
			self.ui.setWindowTitle(str_title)
			self.Up_State()
			self.time1.start(100)