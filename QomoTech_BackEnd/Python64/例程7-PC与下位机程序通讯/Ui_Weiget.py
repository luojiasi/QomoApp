#!/usr/bin/python
# coding:utf-8

from PySide6.QtWidgets import QMessageBox,QFileDialog
from PySide6.QtCore import QFile, QTimer
from PySide6.QtUiTools import QUiLoader

from zmcdll.zauxdllPython import ZAUXDLL
import ctypes



class UiInterFace:
	Zmc = ZAUXDLL()
	time1 = QTimer()
	axislist = (ctypes.c_int * 3)(0, 1, 2)  # 轴列表

	def __init__(self):
		q_state_file = QFile("mainweiget.ui")
		q_state_file.open(QFile.ReadOnly)
		self.ui = QUiLoader().load(q_state_file)
		q_state_file.close()
		self.ui.setFixedSize(847,553)
		self.ui.setWindowTitle("PC与下位机程序通讯")
		self.ip_Scan()
		self.Init()
		self.ConnectHandle()

	def ip_Scan(self):
		self.ui.comboBox.clear()
		self.ui.comboBox.addItem("127.0.0.1")
		ipl = self.Zmc.ZAux_SearchEthlist(10230, 200)[1].value
		ipl=str(ipl.decode('utf-8'))
		# 将列表中的字符数据拼接成字符串
		iplist = ''.join(ipl)
		print(iplist)
		self.ui.comboBox.addItems(iplist.split(" "))

	def Init(self):
		self.Zmc.handle.value = None
		self.ui.edit_com.setText("0")
		self.ui.edit_pci.setText("0")
		# AxisStatue init
		self.ui.edit_State_X.setText("0")
		self.ui.edit_State_Y.setText("0")
		self.ui.edit_State_Z.setText("0")
		# 设置的数据和读取的数据初始化为0
		self.ui.edit_X_Set_1.setText("0")
		self.ui.edit_Y_Set_1.setText("0")
		self.ui.edit_Z_Set_1.setText("0")
		self.ui.edit_X_Set_2.setText("0")
		self.ui.edit_Y_Set_2.setText("0")
		self.ui.edit_Z_Set_2.setText("0")
		self.ui.edit_X_Get_1.setText("0")
		self.ui.edit_Y_Get_1.setText("0")
		self.ui.edit_Z_Get_1.setText("0")
		self.ui.edit_X_Get_2.setText("0")
		self.ui.edit_Y_Get_2.setText("0")
		self.ui.edit_Z_Get_2.setText("0")
		self.ui.edit_Val.setText("0")

		# FLASH
		self.ui.edit_Flash_Num.setText("0")
		self.ui.edit_Flash_Set_1.setText("0")
		self.ui.edit_Flash_Set_2.setText("0")
		self.ui.edit_Flash_Set_3.setText("0")
		self.ui.edit_Flash_Set_4.setText("0")
		self.ui.edit_Flash_Get_1.setText("0")
		self.ui.edit_Flash_Get_2.setText("0")
		self.ui.edit_Flash_Get_3.setText("0")
		self.ui.edit_Flash_Get_4.setText("0")

		# MODBUS
		self.ui.edit_Modbus_Num.setText("0")
		self.ui.edit_Modbus_Set_1.setText("0")
		self.ui.edit_Modbus_Set_2.setText("0")
		self.ui.edit_Modbus_Set_3.setText("0")
		self.ui.edit_Modbus_Set_4.setText("0")
		self.ui.edit_Modbus_Get_1.setText("0")
		self.ui.edit_Modbus_Get_2.setText("0")
		self.ui.edit_Modbus_Get_3.setText("0")
		self.ui.edit_Modbus_Get_4.setText("0")
		self.ui.radioButton_Bit.setChecked(True)

		# VR
		self.ui.edit_VR_Num.setText("0")
		self.ui.edit_VR_Set_1.setText("0")
		self.ui.edit_VR_Set_2.setText("0")
		self.ui.edit_VR_Set_3.setText("0")
		self.ui.edit_VR_Set_4.setText("0")
		self.ui.edit_VR_Get_1.setText("0")
		self.ui.edit_VR_Get_2.setText("0")
		self.ui.edit_VR_Get_3.setText("0")
		self.ui.edit_VR_Get_4.setText("0")

		# TABLE
		self.ui.edit_Table_Num.setText("0")
		self.ui.edit_Table_Set_1.setText("0")
		self.ui.edit_Table_Set_2.setText("0")
		self.ui.edit_Table_Set_3.setText("0")
		self.ui.edit_Table_Set_4.setText("0")
		self.ui.edit_Table_Get_1.setText("0")
		self.ui.edit_Table_Get_2.setText("0")
		self.ui.edit_Table_Get_3.setText("0")
		self.ui.edit_Table_Get_4.setText("0")

	def ConnectHandle(self):
		self.ui.btn_ip_scan.clicked.connect(self.on_btn_ip_scan_clicked)
		self.ui.btn_open.clicked.connect(self.on_btn_open_clicked)
		self.time1.timeout.connect(self.Up_State)
		self.ui.btn_close.clicked.connect(self.on_btn_close_clicked)
		self.ui.btn_loadBAS.clicked.connect(self.on_btn_loadBAS_clicked)
		self.ui.btn_Run_1.clicked.connect(self.on_btn_Run_1_clicked)
		self.ui.btn_Run_2.clicked.connect(self.on_btn_Run_2_clicked)
		self.ui.btn_Stop.clicked.connect(self.on_btn_Stop_clicked)
		self.ui.btn_Clear.clicked.connect(self.on_btn_Clear_clicked)
		self.ui.btn_Val_Read.clicked.connect(self.on_btn_Val_Read_clicked)
		self.ui.btn_Flash_Read.clicked.connect(self.on_btn_Flash_Read_clicked)
		self.ui.btn_Flash_Write.clicked.connect(self.on_btn_Flash_Write_clicked)
		self.ui.btn_VR_Read.clicked.connect(self.on_btn_VR_Read_clicked)
		self.ui.btn_VR_Write.clicked.connect(self.on_btn_VR_Write_clicked)
		self.ui.btn_VR_Read.clicked.connect(self.on_btn_VR_Read_clicked)
		self.ui.btn_VR_Write.clicked.connect(self.on_btn_VR_Write_clicked)
		self.ui.btn_Table_Read.clicked.connect(self.on_btn_Table_Read_clicked)
		self.ui.btn_Table_Write.clicked.connect(self.on_btn_Table_Write_clicked)
		self.ui.btn_Modbus_Read.clicked.connect(self.on_btn_Modbus_Read_clicked)
		self.ui.btn_Modbus_Write.clicked.connect(self.on_btn_Modbus_Write_clicked)
		self.ui.btn_com.clicked.connect(self.on_btn_com_clicked)
		self.ui.btn_pci.clicked.connect(self.on_btn_pci_clicked)
		self.ui.btn_local.clicked.connect(self.on_btn_local_clicked)

	def Up_State(self):
		if self.Zmc.handle.value is None:
				self.ui.setWindowTitle("PC与下位机程序通讯")
				return



		Dpos=self.Zmc.ZAux_Direct_GetDpos(0)[1].value
		Dpos=float(Dpos)
		pos = str(round(Dpos))
		self.ui.edit_State_X.setText(pos)

		Dpos = self.Zmc.ZAux_Direct_GetDpos(1)[1].value
		Dpos = float(Dpos)
		pos = str(round(Dpos))
		self.ui.edit_State_Y.setText(pos)

		Dpos=self.Zmc.ZAux_Direct_GetDpos(2)[1].value
		Dpos=float(Dpos)
		pos = str(round(Dpos))
		self.ui.edit_State_Z.setText(pos)


	def on_btn_ip_scan_clicked(self):
		self.ip_Scan()

	def on_btn_open_clicked(self):
		strtemp = self.ui.comboBox.currentText()
		print("当前的ip是 ：", strtemp)
		if self.Zmc.handle.value is not None:
			self.Zmc.ZAux_Close()
			self.time1.stop()
			self.ui.setWindowTitle("PC与下位机程序通讯")
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
		self.ui.setWindowTitle("PC与下位机程序通讯")

	def on_btn_loadBAS_clicked(self):
		if self.Zmc.handle.value is None:
			QMessageBox.warning(self.ui,"提示","未连接控制器")
			return 
		file_Date = QFileDialog.getOpenFileName(self.ui,"选择BAS文件","..","Files(*.bas)")
		file_Name = file_Date[0].replace("/","\\")
		print(file_Name)
		ret = self.Zmc.ZAux_BasDown(file_Name,1)
		if ret != 0:
			QMessageBox.warning(self.ui,"提示","文件下载失败！" + "错误码为 ：%1 ".format(ret))

	
	def on_btn_Run_1_clicked(self):
		if self.Zmc.handle.value is None:
			QMessageBox.warning(self.ui, "提示", "未连接控制器")
			return
		
		array = (ctypes.c_float * 3)()
		
		array[0] = float(self.ui.edit_X_Set_1.text())
		array[1] = float(self.ui.edit_Y_Set_1.text())
		array[2] = float(self.ui.edit_Z_Set_1.text())

		self.Zmc.ZAux_Direct_SetUserArray("array_para",0,3,array)			#发送数据

		self.Zmc.ZAux_Direct_SetUserVar("cmd_data",1)          #发送命令

	
	def on_btn_Run_2_clicked(self):
		if self.Zmc.handle.value is None:
			QMessageBox.warning(self.ui, "提示", "未连接控制器")
			return
		array = (ctypes.c_float * 3)()
		array[0] = float(self.ui.edit_X_Set_2.text())
		array[1] = float(self.ui.edit_Y_Set_2.text())
		array[2] = float(self.ui.edit_Z_Set_2.text())

		self.Zmc.ZAux_Direct_SetUserArray("array_para2",0,3,array)		#发送数据
		self.Zmc.ZAux_Direct_SetUserVar("cmd_data",2)          #发送命令

	
	def on_btn_Stop_clicked(self):
		if self.Zmc.handle.value is None:
			QMessageBox.warning(self.ui, "提示", "未连接控制器")
			return
		ifidle=self.Zmc.ZAux_Direct_GetIfIdle(self.axislist[0])[1].value
		ifidle=float(ifidle)
		if ifidle:
			QMessageBox.warning(self.ui,"提示","运动已停止")
			return
		self.Zmc.ZAux_Direct_Single_Cancel(self.axislist[0],2)
		self.Zmc.ZAux_Direct_SetUserVar("cmd_data",3)          #发送命令
	
	def on_btn_Clear_clicked(self):
		if self.Zmc.handle.value is None:
			QMessageBox.warning(self.ui, "提示", "未连接控制器")
			return
		for i in range(0,3):
			self.Zmc.ZAux_Direct_SetDpos(i,0)
		self.Zmc.ZAux_Direct_SetUserVar("cmd_data",4)          #发送命令
	
	def on_btn_Val_Read_clicked(self):
		if self.Zmc.handle.value is None:
			QMessageBox.warning(self.ui, "提示", "未连接控制器")
			return

		temp = self.Zmc.ZAux_Direct_GetUserVar("cmd_data")        #读取全局变量
		ret = temp[0]
		cmd_data = temp[1].value
		temp= self.Zmc.ZAux_Direct_GetUserArray("array_para", 0, 3)
		ret += temp[0]
		array= temp[1]
		temp = self.Zmc.ZAux_Direct_GetUserArray("array_para2", 0, 3)
		ret += temp[0]
		array2 = temp[1]
		if ret == 0:
			self.ui.edit_Val.setText(str(round(cmd_data,3)))
			self.ui.edit_X_Get_1.setText(str(round(array[0],3)))
			self.ui.edit_Y_Get_1.setText(str(round(array[1],3)))
			self.ui.edit_Z_Get_1.setText(str(round(array[2],3)))
			self.ui.edit_X_Get_2.setText(str(round(array2[0],3)))
			self.ui.edit_Y_Get_2.setText(str(round(array2[1],3)))
			self.ui.edit_Z_Get_2.setText(str(round(array2[2],3)))

	
	def on_btn_Flash_Read_clicked(self):
		if self.Zmc.handle.value is None:
			QMessageBox.warning(self.ui, "提示", "未连接控制器")
			return
		flash_Number = int(self.ui.edit_Flash_Num.text())
		temp = self.Zmc.ZAux_FlashReadf(flash_Number, 4)
		ret = temp[0]
		Read_data = temp[1]

		if ret != 0:
			QMessageBox.warning(self.ui,"警告","读取失败" + "错误码为 ：{} ".format(ret))
			return
		else:
			self.ui.edit_Flash_Get_1.setText(str(round(Read_data[0],3)))
			self.ui.edit_Flash_Get_2.setText(str(round(Read_data[1],3)))
			self.ui.edit_Flash_Get_3.setText(str(round(Read_data[2],3)))
			self.ui.edit_Flash_Get_4.setText(str(round(Read_data[3],3)))

	
	def on_btn_Flash_Write_clicked(self):
		if self.Zmc.handle.value is None:
			QMessageBox.warning(self.ui, "提示", "未连接控制器")
			return
		flash_Num = int(self.ui.edit_Flash_Num.text())
		Write_data = (ctypes.c_float * 4)()
		Write_data[0] = float(self.ui.edit_Flash_Set_1.text())
		Write_data[1] = float(self.ui.edit_Flash_Set_2.text())
		Write_data[2] = float(self.ui.edit_Flash_Set_3.text())
		Write_data[3] = float(self.ui.edit_Flash_Set_4.text())
		ret = self.Zmc.ZAux_FlashWritef(flash_Num,4,Write_data)

		if ret != 0:
			QMessageBox.warning(self.ui,"警告","写入失败"+ "错误码为 ：%1 ".format(ret))
			return 


	def on_btn_VR_Read_clicked(self):
		if self.Zmc.handle.value is None:
			QMessageBox.warning(self.ui, "提示", "未连接控制器")
			return
		VR_Num = int(self.ui.edit_VR_Num.text())

		temp = self.Zmc.ZAux_Direct_GetVrf(VR_Num,4)
		ret = temp[0]
		Read_data = temp[1]
		if ret != 0:
			QMessageBox.warning(self.ui,"警告","读取失败"+ "错误码为 ：%1 ".format(ret))
			return 
		else:
			self.ui.edit_VR_Get_1.setText(str(round(Read_data[0],3)))
			self.ui.edit_VR_Get_2.setText(str(round(Read_data[1],3)))
			self.ui.edit_VR_Get_3.setText(str(round(Read_data[2],3)))
			self.ui.edit_VR_Get_4.setText(str(round(Read_data[3],3)))

	
	def on_btn_VR_Write_clicked(self):
		if self.Zmc.handle.value is None:
			QMessageBox.warning(self.ui, "提示", "未连接控制器")
			return
		VR_Num = int(self.ui.edit_VR_Num.text())
		Write_data = (ctypes.c_float * 4)()
	
		Write_data[0] = float(self.ui.edit_VR_Set_1.text())
		Write_data[1] = float(self.ui.edit_VR_Set_2.text())
		Write_data[2] = float(self.ui.edit_VR_Set_3.text())
		Write_data[3] = float(self.ui.edit_VR_Set_4.text())
	
		ret = self.Zmc.ZAux_Direct_SetVrf(VR_Num,4,Write_data)
		if ret != 0:
			QMessageBox.warning(self.ui,"警告","写入失败"+ "错误码为 ：{} ".format(ret))
			return 
		

	def on_btn_Table_Read_clicked(self):
		if self.Zmc.handle.value is None:
			QMessageBox.warning(self.ui, "提示", "未连接控制器")
			return
		Table_Num = int(self.ui.edit_Table_Num.text())
		temp = self.Zmc.ZAux_Direct_GetTable(Table_Num,4)
		ret = temp[0]
		Read_data = temp[1]
		if ret != 0:
			QMessageBox.warning(self,"警告","读取失败"+ "错误码为 ：{} ".format(ret))
			return 
		else:
			self.ui.edit_Table_Get_1.setText(str(round(Read_data[0],3)))
			self.ui.edit_Table_Get_2.setText(str(round(Read_data[1],3)))
			self.ui.edit_Table_Get_3.setText(str(round(Read_data[2],3)))
			self.ui.edit_Table_Get_4.setText(str(round(Read_data[3],3)))

	
	def on_btn_Table_Write_clicked(self):
		if self.Zmc.handle.value is None:
			QMessageBox.warning(self.ui, "提示", "未连接控制器")
			return
		Table_Num = int(self.ui.edit_Table_Num.text())
		Write_data = (ctypes.c_float * 4)()
	
		Write_data[0] = float(self.ui.edit_Table_Set_1.text())
		Write_data[1] = float(self.ui.edit_Table_Set_2.text())
		Write_data[2] = float(self.ui.edit_Table_Set_3.text())
		Write_data[3] = float(self.ui.edit_Table_Set_4.text())
	
		ret = self.Zmc.ZAux_Direct_SetTable(Table_Num,4,Write_data)
		if ret != 0:
			QMessageBox.warning(self.ui,"警告","写入失败"+ "错误码为 ：{} ".format(ret))
			return 

	
	def on_btn_Modbus_Read_clicked(self):
		if self.Zmc.handle.value is None:
			QMessageBox.warning(self.ui, "提示", "未连接控制器")
			return
		Modbus_Num = int(self.ui.edit_Modbus_Num.text())
		if self.ui.radioButton_Bit.isChecked():
			temp = self.Zmc.ZAux_Modbus_Get0x(Modbus_Num,4)
			ret = temp[0]
			Read_data = temp[1]
			if ret != 0:
				QMessageBox.warning(self.ui,"警告","读取失败"+ "错误码为 ：{} ".format(ret))
				return
			else:
				self.ui.edit_Modbus_Get_1.setText(str(Read_data[0] & 0x01))
				self.ui.edit_Modbus_Get_2.setText(str(Read_data[0]>>1 & 0x01))
				self.ui.edit_Modbus_Get_3.setText(str(Read_data[0]>>2 & 0x01))
				self.ui.edit_Modbus_Get_4.setText(str(Read_data[0]>>3 & 0x01))
		elif self.ui.radioButton_Reg.isChecked():
			temp = self.Zmc.ZAux_Modbus_Get4x(Modbus_Num,4)
			ret = temp[0]
			Read_data = temp[1]
			if ret != 0:
				QMessageBox.warning(self.ui,"警告","读取失败"+ "错误码为 ：{} ".format(ret))
				return
			else:
				self.ui.edit_Modbus_Get_1.setText(str(Read_data[0]))
				self.ui.edit_Modbus_Get_2.setText(str(Read_data[1]))
				self.ui.edit_Modbus_Get_3.setText(str(Read_data[2]))
				self.ui.edit_Modbus_Get_4.setText(str(Read_data[3]))
		elif self.ui.radioButton_Long.isChecked():
			temp = self.Zmc.ZAux_Modbus_Get4x_Long(Modbus_Num,4)
			ret = temp[0]
			Read_data = temp[1]
			if ret != 0:
				QMessageBox.warning(self,"警告","读取失败"+ "错误码为 ：{} ".format(ret))
				return
			else:
				self.ui.edit_Modbus_Get_1.setText(str(Read_data[0]))
				self.ui.edit_Modbus_Get_2.setText(str(Read_data[1]))
				self.ui.edit_Modbus_Get_3.setText(str(Read_data[2]))
				self.ui.edit_Modbus_Get_4.setText(str(Read_data[3]))
		elif self.ui.radioButton_Ieee.isChecked():
			temp = self.Zmc.ZAux_Modbus_Get4x_Float(Modbus_Num,4)
			ret = temp[0]
			Read_data = temp[1]
			if ret != 0:
				QMessageBox.warning(self.ui,"警告","读取失败"+ "错误码为 ：{}".format(ret))
				return
			else:
				self.ui.edit_Modbus_Get_1.setText(str(round(Read_data[0],3)))
				self.ui.edit_Modbus_Get_2.setText(str(round(Read_data[1],3)))
				self.ui.edit_Modbus_Get_3.setText(str(round(Read_data[2],3)))
				self.ui.edit_Modbus_Get_4.setText(str(round(Read_data[3],3)))

	
	def on_btn_Modbus_Write_clicked(self):
		if self.Zmc.handle.value is None:
			QMessageBox.warning(self.ui, "提示", "未连接控制器")
			return
		Modbus_Num = int(self.ui.edit_Modbus_Num.text())
		if self.ui.radioButton_Bit.isChecked():
			Write_data = (ctypes.c_float * 4)()
			Write_data[0] = float(self.ui.edit_Modbus_Set_1.text())
			Write_data[1] = float(self.ui.edit_Modbus_Set_2.text())
			Write_data[2] = float(self.ui.edit_Modbus_Set_3.text())
			Write_data[3] = float(self.ui.edit_Modbus_Set_4.text())
			pdata  = (ctypes.c_byte * 1)()
			for i in range(0,4):
				if Write_data[i] != 0:
					pdata[0] += int(0x1 << i)
					print(pdata[0])
			ret = self.Zmc.ZAux_Modbus_Set0x(Modbus_Num,4,pdata)   #pdata按位存储MODBUS_BIT
			if ret != 0:
				QMessageBox.warning(self,"警告","写入失败"+ "错误码为 ：{} ".format(ret))
				return
		elif self.ui.radioButton_Reg.isChecked():
			Write_data = (ctypes.c_uint16 * 4)()
			Write_data[0] = int(self.ui.edit_Modbus_Set_1.text())
			Write_data[1] = int(self.ui.edit_Modbus_Set_2.text())
			Write_data[2] = int(self.ui.edit_Modbus_Set_3.text())
			Write_data[3] = int(self.ui.edit_Modbus_Set_4.text())
			ret = self.Zmc.ZAux_Modbus_Set4x(Modbus_Num,4,Write_data)
			if ret != 0:
				QMessageBox.warning(self.ui,"警告","写入失败"+ "错误码为 ：{} ".format(ret))
				return
		elif self.ui.radioButton_Long.isChecked():
			Write_data = (ctypes.c_int * 4)()
			Write_data[0] = int(self.ui.edit_Modbus_Set_1.text())
			Write_data[1] = int(self.ui.edit_Modbus_Set_2.text())
			Write_data[2] = int(self.ui.edit_Modbus_Set_3.text())
			Write_data[3] = int(self.ui.edit_Modbus_Set_4.text())
			ret = self.Zmc.ZAux_Modbus_Set4x_Long(Modbus_Num,4,Write_data)
			if ret != 0:
				QMessageBox.warning(self.ui,"警告","写入失败"+ "错误码为 ：{}".format(ret))
				return
		elif self.ui.radioButton_Ieee.isChecked():
			Write_data = (ctypes.c_float * 4)()
			Write_data[0] = float(self.ui.edit_Modbus_Set_1.text())
			Write_data[1] = float(self.ui.edit_Modbus_Set_2.text())
			Write_data[2] = float(self.ui.edit_Modbus_Set_3.text())
			Write_data[3] = float(self.ui.edit_Modbus_Set_4.text())
			ret = self.Zmc.ZAux_Modbus_Set4x_Float(Modbus_Num,4,Write_data)
			if ret != 0:
				QMessageBox.warning(self.ui,"警告","写入失败"+ "错误码为 ：{} ".format(ret))
				return 

	def on_btn_com_clicked(self):  						# 串口链接
		if self.Zmc.handle.value is not None:
			self.Zmc.ZAux_Close()
			self.Zmc.handle.value = None
			self.ui.setWindowTitle("PC与下位机程序通讯")
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
			self.ui.setWindowTitle("PC与下位机程序通讯")
		card_num = int(self.ui.edit_pci.text())
		iresult = self.Zmc.ZAux_OpenPci(card_num)
		if 0 != iresult:
			self.Zmc.handle.value = None
			QMessageBox.warning(self.ui, "警告", "链接失败")
			self.ui.setWindowTitle("PC与下位机程序通讯")
		else:
			str_title = self.ui.windowTitle() + "    已链接"
			self.ui.setWindowTitle(str_title)
			self.Up_State()
			self.time1.start(100)

	def on_btn_local_clicked(self):
		if self.Zmc.handle.value is not None:
			self.Zmc.close()
			self.Zmc.handle.value = None
			self.ui.setWindowTitle("PC与下位机程序通讯")
		iresult = self.Zmc.ZAux_FastOpen(5, "0", 1000)
		if 0 != iresult:
			self.Zmc.handle.value = None
			QMessageBox.warning(self.ui, "警告", "链接失败")
			self.ui.setWindowTitle("PC与下位机程序通讯")
		else:
			str_title = self.ui.windowTitle() + "    已链接"
			self.ui.setWindowTitle(str_title)
			self.Up_State()
			self.time1.start(100)

