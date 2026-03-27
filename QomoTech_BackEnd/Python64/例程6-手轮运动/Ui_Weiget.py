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
	link_state = 0
	axis_Num = 0
	mode = 0
	cur_linkaxis = -1

	def __init__(self):
		q_state_file = QFile("mainweiget.ui")
		q_state_file.open(QFile.ReadOnly)
		self.ui = QUiLoader().load(q_state_file)
		q_state_file.close()
		self.ui.setFixedSize(411,442)
		self.ui.setWindowTitle("手轮运动")
		self.ip_Scan()
		self.Init()
		self.ConnectHandle()

	def ip_Scan(self):
		self.ui.comboBox.clear()
		self.ui.comboBox.addItem("127.0.0.1")
		ipl = self.Zmc.ZAux_SearchEthlist(10230,200)[1].value
		ipl = str(ipl.decode('utf-8'))
		iplist = ''.join(ipl)
		print(iplist)
		self.ui.comboBox.addItems(iplist.split(" "))

	def Init(self):
		self.Zmc.handle.value = None
		self.ui.edit_com.setText("0")
		self.ui.edit_pci.setText("0")
		# AxisStatue init
		self.ui.edit_State_Hand.setText("未链接")
		self.ui.edit_State_X.setText("0")
		self.ui.edit_State_Y.setText("0")
		self.ui.edit_State_Z.setText("0")
		self.ui.edit_State_Encode.setText("0")
		# 手轮设置初始化
		self.ui.edit_axisEncode.setText("11")
		self.ui.edit_mult.setText("1")


	def ConnectHandle(self):
		self.ui.btn_ip_scan.clicked.connect(self.on_btn_ip_scan_clicked)
		self.ui.btn_open.clicked.connect(self.on_btn_open_clicked)
		self.time1.timeout.connect(self.Up_State)
		self.ui.btn_close.clicked.connect(self.on_btn_close_clicked)
		self.ui.radioButton_ABX.clicked.connect(self.on_radioButton_ABX_clicked)
		self.ui.radioButton_M_F.clicked.connect(self.on_radioButton_M_F_clicked)
		self.ui.radioButton_X.clicked.connect(self.on_radioButton_X_clicked)
		self.ui.radioButton_Y.clicked.connect(self.on_radioButton_Y_clicked)
		self.ui.radioButton_Z.clicked.connect(self.on_radioButton_Z_clicked)
		self.ui.btn_Run.clicked.connect(self.on_btn_Run_clicked)
		self.ui.btn_Stop.clicked.connect(self.on_btn_Stop_clicked)
		self.ui.btn_clear.clicked.connect(self.on_btn_clear_clicked)
		self.ui.btn_com.clicked.connect(self.on_btn_com_clicked)
		self.ui.btn_pci.clicked.connect(self.on_btn_pci_clicked)
		self.ui.btn_local.clicked.connect(self.on_btn_local_clicked)



	def Up_State(self):
		if self.Zmc.handle.value is None:
			self.ui.edit_State_Hand.setText("未链接");
			return
		Dpos = self.Zmc.ZAux_Direct_GetDpos(0)[1].value
		Dpos=float(Dpos)
		pos = str(round(Dpos,2))
		self.ui.edit_State_X.setText(pos)

		Dpos = self.Zmc.ZAux_Direct_GetDpos(1)[1].value
		Dpos = float(Dpos)
		pos = str(round(Dpos, 2))
		self.ui.edit_State_Y.setText(pos)

		Dpos = self.Zmc.ZAux_Direct_GetDpos(2)[1].value
		Dpos = float(Dpos)
		pos = str(round(Dpos, 2))
		self.ui.edit_State_Z.setText(pos)

		Dpos = self.Zmc.ZAux_Direct_GetDpos(int(self.ui.edit_axisEncode.text()))[1].value
		Dpos = float(Dpos)
		pos = str(round(Dpos, 2))
		self.ui.edit_State_Encode.setText(pos)

		self.ui.edit_State_Hand.setText("已链接" if self.link_state else "未链接")

	def on_btn_ip_scan_clicked(self):
		self.ip_Scan()

	def on_btn_open_clicked(self):
		strtemp = self.ui.comboBox.currentText()
		print("当前的ip是 ：", strtemp)
		if self.Zmc.handle.value is not None:
			self.Zmc.ZAux_Close()
			self.time1.stop()
			self.ui.setWindowTitle("手轮运动")
		iresult = self.Zmc.ZAux_OpenEth(strtemp)
		if 0 != iresult:
			QMessageBox.warning(self.ui, "提示", "连接失败")
		else:
			QMessageBox.warning(self.ui, "提示", "连接成功")
			str_title = self.ui.windowTitle() + strtemp
			self.ui.setWindowTitle(str_title)
			self.Up_State()
			self.time1.start(100)
			self.ui.radioButton_X.setChecked(True)
			self.mode = 0
			# 轴选择初始化
			self.ui.radioButton_ABX.setChecked(True)
			self.axis_Num = 0
			# 初始化轴参数
			for i in range(0,4):
				self.Zmc.ZAux_Direct_SetAtype(i,1)					# 轴类型 脉冲轴
				self.Zmc.ZAux_Direct_SetUnits(i,1)						# 脉冲当量 1 脉冲为单位
				self.Zmc.ZAux_Direct_SetSpeed(i,100)					# 速度 UNITS / S
				self.Zmc.ZAux_Direct_SetAccel(i,1000)			# 加速度
				self.Zmc.ZAux_Direct_SetDecelAngle(i,1000)		# 减速度

	def closeEther(self):
		if self.Zmc.handle.value is not None:
			self.Zmc.ZAux_Close()
			self.Zmc.handle.value = None
			self.time1.stop()
			print("关闭")

	def on_btn_close_clicked(self):
		self.closeEther()
		self.ui.setWindowTitle("手轮运动")

	def on_radioButton_ABX_clicked(self):
		self.mode = 0

	def on_radioButton_M_F_clicked(self):
		self.mode = 1

	def on_radioButton_X_clicked(self):
		if self.Zmc.handle.value is None:
			QMessageBox.warning(self.ui, "警告", "未连接控制器")
			return
		self.axis_Num = 0
		if self.cur_linkaxis != self.axis_Num and self.cur_linkaxis != -1:	# 换轴，停止，链接状态断开
			self.Zmc.ZAux_Direct_Single_Cancel(self.cur_linkaxis, 2)
		self.link_state = 0

	def on_radioButton_Y_clicked(self):
		if self.Zmc.handle.value is None:
			QMessageBox.warning(self.ui, "警告", "未连接控制器")
			return
		self.axis_Num = 1
		if self.cur_linkaxis != self.axis_Num and self.cur_linkaxis != -1:
			self.Zmc.ZAux_Direct_Single_Cancel(self.cur_linkaxis, 2) # 停止
		self.link_state = 0

	def on_radioButton_Z_clicked(self):
		if self.Zmc.handle.value is None:
			QMessageBox.warning(self.ui, "警告", "未连接控制器")
			return
		self.axis_Num = 2;
		if self.cur_linkaxis != self.axis_Num and self.cur_linkaxis != -1:
			self.Zmc.ZAux_Direct_Single_Cancel(self.cur_linkaxis, 2)	 # 停止
		self.link_state = 0

	def on_btn_Run_clicked(self):
		if self.Zmc.handle.value is None:
			QMessageBox.warning(self.ui, "警告", "未连接控制器")
			return
		axis_Link = int(self.ui.edit_axisEncode.text())
		self.Zmc.ZAux_Direct_SetSpeed(axis_Link, 100)		# 速度 UNITS / S
		self.Zmc.ZAux_Direct_SetAccel(axis_Link, 1000)	# 加速度
		self.Zmc.ZAux_Direct_SetDecel(axis_Link, 1000)	# 减速度
		if self.mode == 0:
			self.Zmc.ZAux_Direct_SetAtype(axis_Link, 3)		# 轴类型  正交编码器此时类型应该为3，但是链接仿真器是为1才有现象
			self.Zmc.ZAux_Direct_SetUnits(axis_Link, 1)			# 脉冲当量 1 脉冲为单位
		elif self.mode == 1:
			self.Zmc.ZAux_Direct_SetAtype(axis_Link, 6) 		# 轴类型 脉冲方向式编码器
			self.Zmc.ZAux_Direct_SetUnits(axis_Link, 1)	 		# 脉冲当量 1 脉冲为单位
		self.cur_linkaxis = self.axis_Num
		self.Zmc.ZAux_Direct_Connect(float(self.ui.edit_mult.text()), axis_Link, self.cur_linkaxis)
		self.link_state = 1
		axis_List = (ctypes.c_int * 1)()
		axis_List[0] = axis_Link
		distance_List = (ctypes.c_int * 1)(100)
		self.Zmc.ZAux_Direct_Move(1, axis_List, distance_List)

	def on_btn_Stop_clicked(self):
		if self.Zmc.handle.value is None:
			QMessageBox.warning(self.ui, "警告", "未连接控制器")
			return
		# 停止主轴即可
		isidle=self.Zmc.ZAux_Direct_GetIfIdle(self.axis_Num)[1].value
		isidle=int(isidle)
		if isidle:
			return
		self.Zmc.ZAux_Direct_Single_Cancel(self.axis_Num, 2)
		self.link_state = 0

	def on_btn_clear_clicked(self):
		if self.Zmc.handle.value is None:
			QMessageBox.warning(self.ui, "警告", "未连接控制器")
			return
		for i in range(0,3):
			self.Zmc.ZAux_Direct_SetDpos(i, 0)		 # 设置零点
		self.Zmc.ZAux_Direct_SetMpos(int(self.ui.edit_axisEncode.text()),0)  	# 清除编码器坐标

	def on_btn_com_clicked(self):  						# 串口链接
		if self.Zmc.handle.value is not None:
			self.Zmc.ZAux_Close()
			self.Zmc.handle.value = None
			self.ui.setWindowTitle("手轮运动")
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
			self.ui.setWindowTitle("手轮运动")
		card_num = int(self.ui.edit_pci.text())
		iresult = self.Zmc.ZAux_OpenPci(card_num)
		if 0 != iresult:
			self.Zmc.handle.value = None
			QMessageBox.warning(self.ui, "警告", "链接失败")
			self.ui.setWindowTitle("手轮运动")
		else:
			str_title = self.ui.windowTitle() + "    已链接"
			self.ui.setWindowTitle(str_title)
			self.Up_State()
			self.time1.start(100)

	def on_btn_local_clicked(self):
		if self.Zmc.handle.value is not None:
			self.Zmc.ZAux_Close()
			self.Zmc.handle.value = None
			self.ui.setWindowTitle("手轮运动")
		iresult = self.Zmc.ZAux_FastOpen(5, "0", 1000)
		if 0 != iresult:
			self.Zmc.handle.value = None
			QMessageBox.warning(self.ui, "警告", "链接失败")
			self.ui.setWindowTitle("手轮运动")
		else:
			str_title = self.ui.windowTitle() + "    已链接"
			self.ui.setWindowTitle(str_title)
			self.Up_State()
			self.time1.start(100)
