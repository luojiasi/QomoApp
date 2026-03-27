#!/usr/bin/python
# coding:utf-8

from PySide6.QtWidgets import QMessageBox, QFileDialog
from PySide6.QtCore import QFile, QTimer
from PySide6.QtUiTools import QUiLoader

from zmcdll.zauxdllPython import ZAUXDLL
import ctypes


class UiInterFace:
	Zmc = ZAUXDLL()
	time1 = QTimer()

	def __init__(self):
		q_state_file = QFile("mainweiget.ui")
		q_state_file.open(QFile.ReadOnly)
		self.ui = QUiLoader().load(q_state_file)
		q_state_file.close()
		self.ui.setFixedSize(420, 445)
		self.ui.setWindowTitle("在线命令")
		self.ip_Scan()
		self.Init()
		self.ConnectHandle()

	def ip_Scan(self):
		self.ui.comboBox.clear()
		self.ui.comboBox.addItem("127.0.0.1")
		ipl=self.Zmc.ZAux_SearchEthlist( 10230, 200)[1].value
		ipl= str(ipl.decode('utf-8'))
		# 将列表中的字符数据拼接成字符串
		iplist = ''.join(ipl)
		print(iplist)
		self.ui.comboBox.addItems(iplist.split(" "))

	def Init(self):
		self.Zmc.handle.value = None
		self.ui.edit_com.setText("0")
		self.ui.edit_pci.setText("0")

	def ConnectHandle(self):
		self.ui.btn_ip_scan.clicked.connect(self.on_btn_ip_scan_clicked)
		self.ui.btn_open.clicked.connect(self.on_btn_open_clicked)
		self.ui.btn_close.clicked.connect(self.on_btn_close_clicked)
		self.ui.pushButton.clicked.connect(self.on_pushButton_clicked)
		self.ui.btn_clear.clicked.connect(self.on_btn_clear_clicked)
		self.ui.btn_win_close.clicked.connect(self.on_btn_win_close_clicked)
		self.ui.btn_com.clicked.connect(self.on_btn_com_clicked)
		self.ui.btn_pci.clicked.connect(self.on_btn_pci_clicked)
		self.ui.btn_local.clicked.connect(self.on_btn_local_clicked)


	def on_btn_ip_scan_clicked(self):
		self.ip_Scan()

	def on_btn_open_clicked(self):
		strtemp = self.ui.comboBox.currentText()
		print("当前的ip是 ：", strtemp)
		if self.Zmc.handle.value is not None:
			self.Zmc.ZAux_Close()
			self.time1.stop()
			self.ui.setWindowTitle("在线命令")
		iresult = self.Zmc.ZAux_OpenEth(strtemp)
		if 0 != iresult:
			QMessageBox.warning(self.ui, "提示", "连接失败")
		else:
			QMessageBox.warning(self.ui, "提示", "连接成功")
			str_title = self.ui.windowTitle() + strtemp
			self.ui.setWindowTitle(str_title)
			self.time1.start(100)

	def closeEther(self):
		if self.Zmc.handle.value is not None:
			self.Zmc.ZAux_Close()
			self.Zmc.handle.value = None
			self.time1.stop()
			print("关闭")

	def on_btn_close_clicked(self):
		self.closeEther()
		self.ui.setWindowTitle("在线命令")

	def on_pushButton_clicked(self):
		tmp_commandback_buff = (ctypes.c_char * 20480)(0)
		if self.Zmc.handle.value is None:
			self.ui.plainTextEdit_Result.appendPlainText(">>{}\r\n".format("Connect First!"))
			QMessageBox.warning(self.ui, "提示", "未连接到控制器")
			return
		# 从控件获取数据
		tmp_set_buff = self.ui.edit_Cmd.text()
		if tmp_set_buff == "":
			return
		str1 = ">>"
		str1 += tmp_set_buff
		self.ui.plainTextEdit_Result.appendPlainText(str1)
		tmp_set_buff=self.Zmc.ZAux_Execute(tmp_set_buff)[1]
		self.ui.plainTextEdit_Result.appendPlainText(str(tmp_set_buff))

	def on_btn_clear_clicked(self):
		self.ui.plainTextEdit_Result.clear()

	def on_btn_win_close_clicked(self):
		self.ui.close()

	def on_btn_com_clicked(self):  						# 串口链接
		if self.Zmc.handle.value is not None:
			self.Zmc.ZAux_Close()
			self.Zmc.handle.value = None
			self.ui.setWindowTitle("在线命令")
		icomid = int(self.ui.edit_com.text())
		iresult = self.Zmc.ZAux_OpenCom(icomid)
		if 0 != iresult:
			self.Zmc.handle.value = None
			QMessageBox.warning(self.ui, "警告", "链接失败")
		else:
			str_title = self.ui.windowTitle() + "    已链接"
			self.ui.setWindowTitle(str_title)
			self.time1.start(100)

	def on_btn_pci_clicked(self):  				# pci链接
		if self.Zmc.handle.value is not None:
			self.Zmc.ZAux_Close()
			self.Zmc.handle.value = None
			self.ui.setWindowTitle("在线命令")
		card_num = int(self.ui.edit_pci.text())
		iresult = self.Zmc.ZAux_OpenPci(card_num)
		if 0 != iresult:
			self.Zmc.handle.value = None
			QMessageBox.warning(self.ui, "警告", "链接失败")
			self.ui.setWindowTitle("在线命令")
		else:
			str_title = self.ui.windowTitle() + "    已链接"
			self.ui.setWindowTitle(str_title)
			self.time1.start(100)

	def on_btn_local_clicked(self):
		if self.Zmc.handle.value is not None:
			self.Zmc.ZAux_Close()
			self.Zmc.handle.value = None
			self.ui.setWindowTitle("在线命令")
		iresult = self.Zmc.ZAux_FastOpen(5, "0", 1000)
		if 0 != iresult:
			self.Zmc.handle.value = None
			QMessageBox.warning(self.ui, "警告", "链接失败")
			self.ui.setWindowTitle("在线命令")
		else:
			str_title = self.ui.windowTitle() + "    已链接"
			self.ui.setWindowTitle(str_title)
			self.time1.start(100)