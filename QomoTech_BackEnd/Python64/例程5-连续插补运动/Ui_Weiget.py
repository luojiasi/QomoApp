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
	time2 = QTimer()
	mode = 0

	flag_checked1 = 0  # 模式被选择的标志，后面模式选择时使用
	flag_checked2 = 0
	flag_checked3 = 0
	axislist = (ctypes.c_int * 2)(0, 1)
	g_curseges = ctypes.c_uint()  # 当前段
	# 插补运动前4轴坐标和每段force_speed
	destdis = ((ctypes.c_float * 3) * 12)(
		(5, 5,10),
		(-5, 5,10),
		(-5, -5,10),
		(5, -5,10),
		(5, 5,10),
		(-5, 5,10),
		(-5, -5,10),
		(5, -5,10),
		(5, 5,10),
		(-5, 5,10),
		(-5, -5,10),
		(5, -5,10),
	)
	LEGS_MAX = len(destdis)  # 总段数

	def __init__(self):
		q_state_file = QFile("mainweiget.ui")
		q_state_file.open(QFile.ReadOnly)
		self.ui = QUiLoader().load(q_state_file)
		q_state_file.close()
		self.ui.setFixedSize(405,636)
		self.ui.setWindowTitle("连续插补运动")
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
		self.ui.edit_Units.setText("100")
		self.ui.edit_Speed.setText("100")
		self.ui.edit_Accel.setText("1000")
		self.ui.edit_Decel.setText("1000")
		# AxisStatue init
		self.ui.edit_State_Run.setText("停止")
		self.ui.edit_State_X.setText("0")
		self.ui.edit_State_Y.setText("0")
		self.ui.edit_State_Z.setText("0")
		self.ui.edit_State_U.setText("0")
		self.ui.edit_State_Speed.setText("0")
		self.ui.edit_State_Rem.setText("256")
		self.ui.edit_State_Mark.setText("-1")
		# 拐角减速的参数初始化
		self.ui.edit_LSpeed.setText("0")
		self.ui.edit_StartAngle.setText("15")
		self.ui.edit_EndAngle.setText("60")
		self.ui.edit_XiaoR.setText("10")
		self.ui.edit_DaoR.setText("5")

	def ConnectHandle(self):
		self.ui.btn_ip_scan.clicked.connect(self.on_btn_ip_scan_clicked)
		self.ui.btn_open.clicked.connect(self.on_btn_open_clicked)
		self.time1.timeout.connect(self.Up_State)
		self.time2.timeout.connect(self.Up_State2)
		self.ui.btn_close.clicked.connect(self.on_btn_close_clicked)
		self.ui.checkBox_Angle.stateChanged.connect(self.on_checkBox_Angle_stateChanged)
		self.ui.checkBox_XiaoR.stateChanged.connect(self.on_checkBox_XiaoR_stateChanged)
		self.ui.checkBox_DaoR.stateChanged.connect(self.on_checkBox_DaoR_stateChanged)
		self.ui.btn_Run.clicked.connect(self.on_btn_Run_clicked)
		self.ui.btn_Stop.clicked.connect(self.on_btn_Stop_clicked)
		self.ui.btn_clear.clicked.connect(self.on_btn_clear_clicked)
		self.ui.btn_com.clicked.connect(self.on_btn_com_clicked)
		self.ui.btn_pci.clicked.connect(self.on_btn_pci_clicked)
		self.ui.btn_local.clicked.connect(self.on_btn_local_clicked)


	def on_btn_ip_scan_clicked(self):
		self.ip_Scan()

	def Up_State(self):

		Dpos = self.Zmc.ZAux_Direct_GetDpos(0)[1].value
		Dpos=float(Dpos)
		pos = str(round(Dpos,2))
		self.ui.edit_State_X.setText(pos)

		Dpos=self.Zmc.ZAux_Direct_GetDpos(1)[1].value
		Dpos=float(Dpos)
		pos = str(round(Dpos,2))
		self.ui.edit_State_Y.setText(pos)

		Dpos = self.Zmc.ZAux_Direct_GetDpos(2)[1].value
		Dpos=float(Dpos)
		pos = str(round(Dpos, 2))
		self.ui.edit_State_Z.setText(pos)

		Dpos = self.Zmc.ZAux_Direct_GetDpos(3)[1].value
		Dpos=float(Dpos)
		pos = str(round(Dpos, 2))
		self.ui.edit_State_U.setText(pos)

		speed=self.Zmc.ZAux_Direct_GetVpSpeed(0)[1].value
		Dpos=float(Dpos)
		speedtex = str(round(speed,2))
		self.ui.edit_State_Speed.setText(speedtex)

		# rembuff = ctypes.c_int(0)
		# curmark = ctypes.c_int(0)
		# 判断存放直线的剩余缓冲 ，ZAux_Direct_GetRemain_Buffer判断的空间圆弧的缓冲，也是占缓冲最大的运动
		rembuff=self.Zmc.ZAux_Direct_GetRemain_LineBuffer(0)[1].value
		rembuff=int(rembuff)
		pos = str(rembuff)
		self.ui.edit_State_Rem.setText(pos)

		# 判断当前运动到第几条运动，
		curmark=self.Zmc.ZAux_Direct_GetMoveCurmark(0)[1].value
		curmark=int (curmark)
		pos = str(curmark)
		self.ui.edit_State_Mark.setText(pos)

		ifidle=self.Zmc.ZAux_Direct_GetIfIdle(0)[1].value
		ifidle=int(ifidle)
		self.ui.edit_State_Run.setText("停止" if ifidle else "运动中")

	def Up_State2(self):
		for i in range(0, 10):  # 每次定时器中断填入几个运动缓冲，可修改
			if self.g_curseges >= self.LEGS_MAX:  # 是否填完
				self.time2.stop()
				return
		iremain=self.Zmc.ZAux_Direct_GetRemain_LineBuffer(0)[1].value # 不同类型插补函数不同、直线插补缓冲判断用ZAux_Direct_GetRemain_LineBuffer
		iremain=int(iremain)
		if iremain > 0:
			# 加入一段, 每段可以有自己的ForceSpeed
			iresult=self.Zmc.ZAux_Direct_SetForceSpeed(0, self.destdis[self.g_curseges][2])
			self.Zmc.ZAux_Direct_MoveAbsSp(2, self.axislist, self.destdis[self.g_curseges])
			if 0 != iresult:
				print("call function return error")
			self.g_curseges = self.g_curseges + 1

	def on_btn_open_clicked(self):
		strtemp = self.ui.comboBox.currentText()
		print("当前的ip是 ：", strtemp)
		if self.Zmc.handle.value is not None:
			self.Zmc.ZAux_Close()
			self.time1.stop()
			self.ui.setWindowTitle("连续插补运动")
		iresult = self.Zmc.ZAux_OpenEth(strtemp)
		if 0 != iresult:
			QMessageBox.warning(self.ui, "提示", "连接失败")
		else:
			QMessageBox.warning(self.ui, "提示", "连接成功")
			str_title = self.ui.windowTitle() + strtemp
			self.ui.setWindowTitle(str_title)
			self.Up_State()
			self.time1.start(100)
			self.ui.checkBox_Angle.setChecked(True)

	def closeEther(self):
		if self.Zmc.handle.value is not None:
			self.Zmc.ZAux_Close()
			self.Zmc.handle.value = None
			self.time1.stop()
			print("关闭")

	def on_btn_close_clicked(self):
		self.closeEther()
		self.ui.setWindowTitle("连续插补运动")

	def on_checkBox_Angle_stateChanged(self, arg1):
		if self.Zmc.handle.value is None:
			QMessageBox.warning(self.ui, "警告", "未连接控制器")
			return
		if arg1 == 2:
			self.mode += 2
			self.flag_checked1 = 1
			print("mode = ", self.mode)
		elif arg1 == 0:
			if self.flag_checked1 == 1:  # 只有当此按钮被选中之后才需要减操作，此按钮若之前未被选中则不需要减操作
				self.mode -= 2
				self.flag_checked1 = 0
				print("mode = ", self.mode)

	def on_checkBox_XiaoR_stateChanged(self, arg1):
		if self.Zmc.handle.value is None:
			QMessageBox.warning(self.ui, "警告", "未连接控制器")
			return
		if arg1 == 2:
			self.mode += 8
			self.flag_checked2 = 1
			print("mode = ", self.mode)
		elif arg1 == 0:
			if self.flag_checked2 == 1:  # 只有当此按钮被选中之后才需要减操作，此按钮若之前未被选中则不需要减操作
				self.mode -= 8
				self.flag_checked2 = 0
				print("mode = ", self.mode)

	def on_checkBox_DaoR_stateChanged(self, arg1):
		if self.Zmc.handle.value is None:
			QMessageBox.warning(self.ui, "警告", "未连接控制器")
			return
		if arg1 == 2:
			self.mode += 32
			self.flag_checked3 = 1
			print("mode = ", self.mode)
		elif arg1 == 0:
			if self.flag_checked3 == 1:  # 只有当此按钮被选中之后才需要减操作，此按钮若之前未被选中则不需要减操作
				self.mode -= 32
				self.flag_checked3 = 0
				print("mode = ", self.mode)

	def on_btn_Run_clicked(self):
		if self.Zmc.handle.value is None:
			QMessageBox.warning(self.ui, "警告", "未连接控制器")
			return

		isidle=self.Zmc.ZAux_Direct_GetIfIdle(0)[1].value
		isidle=int(isidle)
		if not isidle:
			QMessageBox.warning(self.ui, "警告", "正在运动中")
			return
		# 选择参与运动的轴，第一个轴为主轴，插补参数全用主轴参数
		self.Zmc.ZAux_Direct_Base(4, self.axislist)
		self.Zmc.ZAux_Direct_SetUnits(self.axislist[0], float(self.ui.edit_Units.text()))
		self.Zmc.ZAux_Direct_SetSpeed(self.axislist[0], float(self.ui.edit_Speed.text()))  # 速度	UNITS / S
		self.Zmc.ZAux_Direct_SetAccel(self.axislist[0], float(self.ui.edit_Accel.text()))  # 加速度
		self.Zmc.ZAux_Direct_SetDecel(self.axislist[0], float(self.ui.edit_Decel.text()))  # 减速度UpdateData(true)
		#  刷新参数
		self.Zmc.ZAux_Direct_SetLspeed(self.axislist[0], float(self.ui.edit_LSpeed.text()))  # 起始速度
		self.Zmc.ZAux_Direct_SetMerge(self.axislist[0], 1)  # 连续插补开关
		self.Zmc.ZAux_Direct_SetCornerMode(self.axislist[0], self.mode)  # 拐角模式
		# 开始减速角度，转换为弧度
		self.Zmc.ZAux_Direct_SetDecelAngle(self.axislist[0], float(self.ui.edit_StartAngle.text()) * 3.14 / 180)
		self.Zmc.ZAux_Direct_SetStopAngle(self.axislist[0], float(self.ui.edit_EndAngle.text()) * 3.14 / 180)
		# 自动小圆限速
		self.Zmc.ZAux_Direct_SetFullSpRadius(self.axislist[0], float(self.ui.edit_XiaoR.text()))
		# 倒角减速
		self.Zmc.ZAux_Direct_SetZsmooth(self.axislist[0], float(self.ui.edit_DaoR.text()))

		# SP指令中自动拐角模式中设置一个较大的startmovespeed与endmovespeed
		self.Zmc.ZAux_Direct_SetStartMoveSpeed(self.axislist[0], 10000)
		self.Zmc.ZAux_Direct_SetEndMoveSpeed(self.axislist[0], 10000)

		# 调用运动 通过检查是否还有剩余缓冲来确定是否发运动
		self.Zmc.ZAux_Direct_SetMovemark(self.axislist[0], 0)  # 设置MARK = 0 ，来通过读取CURMARK实现判断当前执行到那里
		self.g_curseges = 0
		self.time2.start(100)

	def on_btn_Stop_clicked(self):
		if self.Zmc.handle.value is None:
			QMessageBox.warning(self.ui, "警告", "未连接控制器")
			return
		isidle=self.Zmc.ZAux_Direct_GetIfIdle(0)[1].value
		isidle=int(isidle)
		if isidle:
			QMessageBox.warning(self.ui, "警告", "已经停止了")
			return
		self.time2.stop()
		self.Zmc.ZAux_Direct_Single_Cancel(0, 2)  # 停止主轴BASE的一个轴

	def on_btn_clear_clicked(self):
		if self.Zmc.handle.value is None:
			QMessageBox.warning(self.ui, "警告", "未连接控制器")
			return
		for i in range(0, 4):
			self.Zmc.ZAux_Direct_SetDpos(i, 0)

	def on_btn_com_clicked(self):  						# 串口链接
		if self.Zmc.handle.value is not None:
			self.Zmc.ZAux_Close()
			self.Zmc.handle.value = None
			self.ui.setWindowTitle("连续插补运动")
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
			self.ui.setWindowTitle("连续插补运动")
		card_num = int(self.ui.edit_pci.text())
		iresult = self.Zmc.ZAux_OpenPci(card_num)
		if 0 != iresult:
			self.Zmc.handle.value = None
			QMessageBox.warning(self.ui, "警告", "链接失败")
			self.ui.setWindowTitle("连续插补运动")
		else:
			str_title = self.ui.windowTitle() + "    已链接"
			self.ui.setWindowTitle(str_title)
			self.Up_State()
			self.time1.start(100)

	def on_btn_local_clicked(self):
		if self.Zmc.handle.value is not None:
			self.Zmc.ZAux_Close()
			self.Zmc.handle.value = None
			self.ui.setWindowTitle("连续插补运动")
		iresult = self.Zmc.ZAux_FastOpen(5, "0", 1000)
		if 0 != iresult:
			self.Zmc.handle.value = None
			QMessageBox.warning(self.ui, "警告", "链接失败")
			self.ui.setWindowTitle("连续插补运动")
		else:
			str_title = self.ui.windowTitle() + "    已链接"
			self.ui.setWindowTitle(str_title)
			self.Up_State()
			self.time1.start(100)