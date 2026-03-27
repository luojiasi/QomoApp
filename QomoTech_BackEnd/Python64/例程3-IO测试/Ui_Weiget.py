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
	m_out0 = False
	m_out1 = False
	m_out2 = False
	m_out3 = False
	m_outall = False
	m_evenhome = False
	m_evenalm = False
	m_evenfwd = False
	m_evenrev = False

	def __init__(self):
		q_state_file = QFile("mainweiget.ui")
		q_state_file.open(QFile.ReadOnly)
		self.ui = QUiLoader().load(q_state_file)
		q_state_file.close()
		self.ui.setFixedSize(426, 484)
		self.ui.setWindowTitle("IO测试")
		self.ip_Scan()
		self.Init()
		self.ConnectHandle()

	def ip_Scan(self):
		self.ui.comboBox.clear()
		self.ui.comboBox.addItem("127.0.0.1")
		ipl=self.Zmc.ZAux_SearchEthlist(10230, 200)[1].value
		ipl=str(ipl.decode('utf-8'))
		iplist = ''.join(ipl)
		print(iplist)
		self.ui.comboBox.addItems(iplist.split(" "))

	def Init(self):
		self.Zmc.handle.value = None
		self.ui.edit_com.setText("0")
		self.ui.edit_pci.setText("0")
		# Axis Paramter init
		self.ui.edit_In0.setText("0")
		self.ui.edit_In1.setText("0")
		self.ui.edit_In2.setText("0")
		self.ui.edit_In3.setText("0")
		# 轴状态
		self.ui.edit_axisState.setText("正常")

	def ConnectHandle(self):
		self.ui.btn_ip_scan.clicked.connect(self.on_btn_ip_scan_clicked)
		self.ui.btn_open.clicked.connect(self.on_btn_open_clicked)
		self.time1.timeout.connect(self.Up_State)
		self.ui.btn_close.clicked.connect(self.on_btn_close_clicked)
		self.ui.checkBox_out0.stateChanged.connect(self.on_checkBox_out0_stateChanged)
		self.ui.checkBox_out1.stateChanged.connect(self.on_checkBox_out1_stateChanged)
		self.ui.checkBox_out2.stateChanged.connect(self.on_checkBox_out2_stateChanged)
		self.ui.checkBox_out3.stateChanged.connect(self.on_checkBox_out3_stateChanged)
		self.ui.checkBox_outAll.stateChanged.connect(self.on_checkBox_outAll_stateChanged)
		self.ui.checkBox_in0.stateChanged.connect(self.on_checkBox_in0_stateChanged)
		self.ui.checkBox_in1.stateChanged.connect(self.on_checkBox_in1_stateChanged)
		self.ui.checkBox_in2.stateChanged.connect(self.on_checkBox_in2_stateChanged)
		self.ui.checkBox_in3.stateChanged.connect(self.on_checkBox_in3_stateChanged)
		self.ui.btn_com.clicked.connect(self.on_btn_com_clicked)
		self.ui.btn_pci.clicked.connect(self.on_btn_pci_clicked)
		self.ui.btn_local.clicked.connect(self.on_btn_local_clicked)
	def on_btn_ip_scan_clicked(self):
		self.ip_Scan()

	def Up_State(self):
		iostatus = [ctypes.c_int(-1) for i in range(0, 4)]
		for i in range(0, 4):
			iostatus[i]=self.Zmc.ZAux_Direct_GetIn(i)[1].value
			iostatus[i]=int(iostatus[i])

			str_tmp = str(1 if iostatus[0] else 0)
			self.ui.edit_In0.setText(str_tmp)

			str_tmp = str(1 if iostatus[1] else 0)
			self.ui.edit_In1.setText(str_tmp)

			str_tmp = str(1 if iostatus[2] else 0)
			self.ui.edit_In2.setText(str_tmp)

			str_tmp = str(1 if iostatus[3] else 0)
			self.ui.edit_In3.setText(str_tmp)

		axisstatus=self.Zmc.ZAux_Direct_GetAxisStatus(0)[1].value
		axisstatus=int(axisstatus)
		if axisstatus == 0:  # 正常
			str1 = "正常"
		else:
			str1 = ""
		if axisstatus & (1 << 22):  # ALM 报警
			str1 += "ALM 报警 "

		if axisstatus & (1 << 4):  # 正向限位
			str1 += " 正向限位 "
		if axisstatus & (1 << 5):  # 负向限位
			str1 += " 负向限位 "
		self.ui.edit_axisState.setText(str1)

	def io_Init(self):
		#配置轴0 特殊IO
		self.Zmc.ZAux_Direct_SetDatumIn(0,0) 		#原点
		self.Zmc.ZAux_Direct_SetAlmIn(0, 1)		#伺服报警
		self.Zmc.ZAux_Direct_SetFwdIn(0, 2)		#正限位
		self.Zmc.ZAux_Direct_SetRevIn(0, 3)		#负限位
		# IO口为常开还是常闭
		self.Zmc.ZAux_Direct_SetInvertIn(0, self.m_evenhome)
		self.Zmc.ZAux_Direct_SetInvertIn(0, self.m_evenalm)
		self.Zmc.ZAux_Direct_SetInvertIn(0, self.m_evenfwd)
		self.Zmc.ZAux_Direct_SetInvertIn(0, self.m_evenrev)


	def on_btn_open_clicked(self):
		strtemp = self.ui.comboBox.currentText()
		print("当前的ip是 ：", strtemp)
		if self.Zmc.handle.value is not None:
			self.Zmc.ZAux_Close()
			self.time1.stop()
			self.ui.setWindowTitle("IO测试")
		iresult = self.Zmc.ZAux_OpenEth(strtemp)
		if 0 != iresult:
			QMessageBox.warning(self.ui, "提示", "连接失败")
		else:
			QMessageBox.warning(self.ui, "提示", "连接成功")
			str_title = self.ui.windowTitle() + strtemp
			self.ui.setWindowTitle(str_title)
			self.Up_State()
			self.time1.start(100)
			self.io_Init()
			self.ui.checkBox_in1.setChecked(True)
			self.ui.checkBox_in2.setChecked(True)
			self.ui.checkBox_in3.setChecked(True)

	def closeEther(self):
		if self.Zmc.handle.value is not None:
			self.Zmc.ZAux_Close()
			self.Zmc.handle.value = None
			self.time1.stop()
			print("关闭")

	def on_btn_close_clicked(self):
		self.closeEther()
		self.ui.setWindowTitle("IO测试")

	def on_checkBox_out0_stateChanged(self, arg1):
		if self.Zmc.handle is None:
			QMessageBox.warning(self.ui, "警告", "未连接控制器")
			return
		if 2 == arg1:
			self.m_out0 = True
			self.Zmc.ZAux_Direct_SetOp(0, self.m_out0)
			self.ui.checkBox_out0.setText("out0开启")
		elif 0 == arg1:
			self.m_out0 = False
			self.Zmc.ZAux_Direct_SetOp(0, self.m_out0)
			self.ui.checkBox_out0.setText("out0关闭")

	def on_checkBox_out1_stateChanged(self, arg1):
		if self.Zmc.handle.value is None:
			QMessageBox.warning(self.ui, "警告", "未连接控制器")
			return
		if 2 == arg1:
			self.m_out1 = True
			self.Zmc.ZAux_Direct_SetOp(1, self.m_out1)
			self.ui.checkBox_out1.setText("out1开启")
		elif 0 == arg1:
			self.m_out1 = False
			self.Zmc.ZAux_Direct_SetOp(1, self.m_out1)
			self.ui.checkBox_out1.setText("out1关闭")

	def on_checkBox_out2_stateChanged(self, arg1):
		if self.Zmc.handle.value is None:
			QMessageBox.warning(self.ui, "警告", "未连接控制器")
			return
		if 2 == arg1:
			self.m_out2 = True
			self.Zmc.ZAux_Direct_SetOp(2, self.m_out2)
			self.ui.checkBox_out2.setText("out2开启")
		elif 0 == arg1:
			self.m_out2 = False
			self.Zmc.ZAux_Direct_SetOp(2, self.m_out2)
			self.ui.checkBox_out2.setText("out2关闭")

	def on_checkBox_out3_stateChanged(self, arg1):
		if self.Zmc.handle.value is None:
			QMessageBox.warning(self.ui, "警告", "未连接控制器")
			return
		if 2 == arg1:
			self.m_out3 = True
			self.Zmc.ZAux_Direct_SetOp(3, self.m_out3)
			self.ui.checkBox_out3.setText("out3开启")
		elif 0 == arg1:
			self.m_out3 = False
			self.Zmc.ZAux_Direct_SetOp(3, self.m_out3)
			self.ui.checkBox_out3.setText("out3关闭")

	def on_checkBox_outAll_stateChanged(self, arg1):
		if self.Zmc.handle.value is None:
			QMessageBox.warning(self.ui, "警告", "未连接控制器")
			return
		if arg1 == 2:
			iostate = 15
			self.Zmc.ZAux_Modbus_Set0x(20000, 4, [iostate])  # MODBUS_BIT(20000)映射到控制输出口 ，打开输出0 - 3二进制15 1111
			self.ui.checkBox_outAll.setText("全部开启")
			self.ui.checkBox_out0.setChecked(True)
			self.ui.checkBox_out1.setChecked(True)
			self.ui.checkBox_out2.setChecked(True)
			self.ui.checkBox_out3.setChecked(True)
		elif arg1 == 0:
			iostate = 0
			self.Zmc.ZAux_Modbus_Set0x(20000, 4, [iostate])
			self.ui.checkBox_outAll.setText("全部关闭")
			self.ui.checkBox_out0.setChecked(False)
			self.ui.checkBox_out1.setChecked(False)
			self.ui.checkBox_out2.setChecked(False)
			self.ui.checkBox_out3.setChecked(False)

	def on_checkBox_in0_stateChanged(self, arg1):
		if self.Zmc.handle.value is None:
			QMessageBox.warning(self.ui, "警告", "未连接控制器")
			return
		if arg1 == 2:
			self.m_evenhome = True
			self.Zmc.ZAux_Direct_SetInvertIn(0, self.m_evenhome)
		elif arg1 == 0:
			self.m_evenhome = False
			self.Zmc.ZAux_Direct_SetInvertIn(0, self.m_evenhome)

	def on_checkBox_in1_stateChanged(self, arg1):
		if self.Zmc.handle.value is None:
			QMessageBox.warning(self.ui, "警告", "未连接控制器")
			return
		if arg1 == 2:
			self.m_evenalm = True
			self.Zmc.ZAux_Direct_SetInvertIn(1, self.m_evenalm)
		elif arg1 == 0:
			self.m_evenalm = False
			self.Zmc.ZAux_Direct_SetInvertIn(1, self.m_evenalm)

	def on_checkBox_in2_stateChanged(self, arg1):
		if self.Zmc.handle.value is None:
			QMessageBox.warning(self.ui, "警告", "未连接控制器")
			return
		if arg1 == 2:
			self.m_evenfwd = True
			self.Zmc.ZAux_Direct_SetInvertIn(2, self.m_evenfwd)
		elif arg1 == 0:
			self.m_evenfwd = False
			self.Zmc.ZAux_Direct_SetInvertIn(2, self.m_evenfwd)

	def on_checkBox_in3_stateChanged(self, arg1):
		if self.Zmc.handle.value is None:
			QMessageBox.warning(self.ui, "警告", "未连接控制器")
			return
		if arg1 == 2:
			self.m_evenrev = True
			self.Zmc.ZAux_Direct_SetInvertIn(3, self.m_evenrev)
		elif arg1 == 0:
			self.m_evenrev = False
			self.Zmc.ZAux_Direct_SetInvertIn(3, self.m_evenrev)

	def on_btn_com_clicked(self):  # 串口链接
		if self.Zmc.handle.value is not None:
			self.Zmc.ZAux_Close()
			self.Zmc.handle.value = None
			self.ui.setWindowTitle("IO测试")
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
			self.ui.setWindowTitle("IO测试")
		card_num = int(self.ui.edit_pci.text())
		iresult = self.Zmc.ZAux_OpenPci(card_num)
		if 0 != iresult:
			self.Zmc.handle.value = None
			QMessageBox.warning(self.ui, "警告", "链接失败")
			self.ui.setWindowTitle("IO测试")
		else:
			str_title = self.ui.windowTitle() + "    已链接"
			self.ui.setWindowTitle(str_title)
			self.Up_State()
			self.time1.start(100)

	def on_btn_local_clicked(self):
		if self.Zmc.handle.value is not None:		#local接口
			self.Zmc.ZAux_Close()
			self.Zmc.handle.value = None
			self.ui.setWindowTitle("IO测试")
		iresult = self.Zmc.ZAux_FastOpen(5, "0", 1000)
		if 0 != iresult:
			self.Zmc.handle.value = None
			QMessageBox.warning(self.ui, "警告", "链接失败")
			self.ui.setWindowTitle("IO测试")
		else:
			str_title = self.ui.windowTitle() + "    已链接"
			self.ui.setWindowTitle(str_title)
			self.Up_State()
			self.time1.start(100)
