#!/usr/bin/python
# coding:utf-8

"""
@author:ocean
@contact:xx@xx.com
@software:PyCharm
@file:main.py
@time:2023/3/15 18:52
"""
from PySide6.QtWidgets import QApplication
from Ui_Weiget import UiInterFace


if __name__ == "__main__":
	app = QApplication([])
	ui_interface = UiInterFace()
	ui_interface.ui.show()
	app.exec_()

	abc = 100
	print(id(abc))
	abc = 200
	print(id(abc))