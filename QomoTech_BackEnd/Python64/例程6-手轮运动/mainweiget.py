# -*- coding: utf-8 -*-

################################################################################
## Form generated from reading UI file 'mainweiget.ui'
##
## Created by: Qt User Interface Compiler version 5.15.2
##
## WARNING! All changes made in this file will be lost when recompiling UI file!
################################################################################

from PySide6.QtCore import *
from PySide6.QtGui import *
from PySide6.QtWidgets import *


class Ui_Form(object):
    def setupUi(self, Form):
        if not Form.objectName():
            Form.setObjectName(u"Form")
        Form.resize(493, 475)
        self.groupBox = QGroupBox(Form)
        self.groupBox.setObjectName(u"groupBox")
        self.groupBox.setGeometry(QRect(0, 0, 391, 60))
        sizePolicy = QSizePolicy(QSizePolicy.Preferred, QSizePolicy.Fixed)
        sizePolicy.setHorizontalStretch(0)
        sizePolicy.setVerticalStretch(0)
        sizePolicy.setHeightForWidth(self.groupBox.sizePolicy().hasHeightForWidth())
        self.groupBox.setSizePolicy(sizePolicy)
        self.label = QLabel(self.groupBox)
        self.label.setObjectName(u"label")
        self.label.setGeometry(QRect(6, 22, 20, 20))
        sizePolicy1 = QSizePolicy(QSizePolicy.Fixed, QSizePolicy.Preferred)
        sizePolicy1.setHorizontalStretch(0)
        sizePolicy1.setVerticalStretch(0)
        sizePolicy1.setHeightForWidth(self.label.sizePolicy().hasHeightForWidth())
        self.label.setSizePolicy(sizePolicy1)
        self.comboBox = QComboBox(self.groupBox)
        self.comboBox.setObjectName(u"comboBox")
        self.comboBox.setGeometry(QRect(28, 20, 111, 23))
        sizePolicy2 = QSizePolicy(QSizePolicy.Fixed, QSizePolicy.Fixed)
        sizePolicy2.setHorizontalStretch(0)
        sizePolicy2.setVerticalStretch(0)
        sizePolicy2.setHeightForWidth(self.comboBox.sizePolicy().hasHeightForWidth())
        self.comboBox.setSizePolicy(sizePolicy2)
        self.comboBox.setEditable(True)
        self.btn_close = QPushButton(self.groupBox)
        self.btn_close.setObjectName(u"btn_close")
        self.btn_close.setGeometry(QRect(310, 20, 75, 23))
        sizePolicy2.setHeightForWidth(self.btn_close.sizePolicy().hasHeightForWidth())
        self.btn_close.setSizePolicy(sizePolicy2)
        self.btn_open = QPushButton(self.groupBox)
        self.btn_open.setObjectName(u"btn_open")
        self.btn_open.setGeometry(QRect(229, 20, 75, 23))
        sizePolicy2.setHeightForWidth(self.btn_open.sizePolicy().hasHeightForWidth())
        self.btn_open.setSizePolicy(sizePolicy2)
        self.btn_ip_scan = QPushButton(self.groupBox)
        self.btn_ip_scan.setObjectName(u"btn_ip_scan")
        self.btn_ip_scan.setGeometry(QRect(140, 20, 87, 23))
        self.groupBox_4 = QGroupBox(Form)
        self.groupBox_4.setObjectName(u"groupBox_4")
        self.groupBox_4.setGeometry(QRect(0, 120, 109, 171))
        self.verticalLayout_2 = QVBoxLayout(self.groupBox_4)
        self.verticalLayout_2.setObjectName(u"verticalLayout_2")
        self.radioButton_X = QRadioButton(self.groupBox_4)
        self.radioButton_X.setObjectName(u"radioButton_X")

        self.verticalLayout_2.addWidget(self.radioButton_X)

        self.radioButton_Y = QRadioButton(self.groupBox_4)
        self.radioButton_Y.setObjectName(u"radioButton_Y")

        self.verticalLayout_2.addWidget(self.radioButton_Y)

        self.radioButton_Z = QRadioButton(self.groupBox_4)
        self.radioButton_Z.setObjectName(u"radioButton_Z")

        self.verticalLayout_2.addWidget(self.radioButton_Z)

        self.groupBox_5 = QGroupBox(Form)
        self.groupBox_5.setObjectName(u"groupBox_5")
        self.groupBox_5.setGeometry(QRect(120, 120, 141, 171))
        self.verticalLayout_4 = QVBoxLayout(self.groupBox_5)
        self.verticalLayout_4.setObjectName(u"verticalLayout_4")
        self.groupBox_6 = QGroupBox(self.groupBox_5)
        self.groupBox_6.setObjectName(u"groupBox_6")
        self.gridLayout = QGridLayout(self.groupBox_6)
        self.gridLayout.setObjectName(u"gridLayout")
        self.label_7 = QLabel(self.groupBox_6)
        self.label_7.setObjectName(u"label_7")

        self.gridLayout.addWidget(self.label_7, 0, 0, 1, 1)

        self.edit_axisEncode = QLineEdit(self.groupBox_6)
        self.edit_axisEncode.setObjectName(u"edit_axisEncode")

        self.gridLayout.addWidget(self.edit_axisEncode, 0, 1, 1, 1)

        self.label_8 = QLabel(self.groupBox_6)
        self.label_8.setObjectName(u"label_8")

        self.gridLayout.addWidget(self.label_8, 1, 0, 1, 1)

        self.edit_mult = QLineEdit(self.groupBox_6)
        self.edit_mult.setObjectName(u"edit_mult")

        self.gridLayout.addWidget(self.edit_mult, 1, 1, 1, 1)


        self.verticalLayout_4.addWidget(self.groupBox_6)

        self.groupBox_7 = QGroupBox(self.groupBox_5)
        self.groupBox_7.setObjectName(u"groupBox_7")
        self.verticalLayout_3 = QVBoxLayout(self.groupBox_7)
        self.verticalLayout_3.setObjectName(u"verticalLayout_3")
        self.radioButton_ABX = QRadioButton(self.groupBox_7)
        self.radioButton_ABX.setObjectName(u"radioButton_ABX")

        self.verticalLayout_3.addWidget(self.radioButton_ABX)

        self.radioButton_M_F = QRadioButton(self.groupBox_7)
        self.radioButton_M_F.setObjectName(u"radioButton_M_F")

        self.verticalLayout_3.addWidget(self.radioButton_M_F)


        self.verticalLayout_4.addWidget(self.groupBox_7)

        self.groupBox_8 = QGroupBox(Form)
        self.groupBox_8.setObjectName(u"groupBox_8")
        self.groupBox_8.setGeometry(QRect(270, 120, 121, 171))
        self.verticalLayout_5 = QVBoxLayout(self.groupBox_8)
        self.verticalLayout_5.setObjectName(u"verticalLayout_5")
        self.btn_Run = QPushButton(self.groupBox_8)
        self.btn_Run.setObjectName(u"btn_Run")

        self.verticalLayout_5.addWidget(self.btn_Run)

        self.btn_Stop = QPushButton(self.groupBox_8)
        self.btn_Stop.setObjectName(u"btn_Stop")

        self.verticalLayout_5.addWidget(self.btn_Stop)

        self.btn_clear = QPushButton(self.groupBox_8)
        self.btn_clear.setObjectName(u"btn_clear")

        self.verticalLayout_5.addWidget(self.btn_clear)

        self.groupBox_2 = QGroupBox(Form)
        self.groupBox_2.setObjectName(u"groupBox_2")
        self.groupBox_2.setGeometry(QRect(0, 60, 291, 61))
        self.horizontalLayout = QHBoxLayout(self.groupBox_2)
        self.horizontalLayout.setObjectName(u"horizontalLayout")
        self.label_2 = QLabel(self.groupBox_2)
        self.label_2.setObjectName(u"label_2")

        self.horizontalLayout.addWidget(self.label_2)

        self.edit_State_X = QLineEdit(self.groupBox_2)
        self.edit_State_X.setObjectName(u"edit_State_X")
        self.edit_State_X.setReadOnly(True)

        self.horizontalLayout.addWidget(self.edit_State_X)

        self.label_3 = QLabel(self.groupBox_2)
        self.label_3.setObjectName(u"label_3")

        self.horizontalLayout.addWidget(self.label_3)

        self.edit_State_Y = QLineEdit(self.groupBox_2)
        self.edit_State_Y.setObjectName(u"edit_State_Y")
        self.edit_State_Y.setReadOnly(True)

        self.horizontalLayout.addWidget(self.edit_State_Y)

        self.label_4 = QLabel(self.groupBox_2)
        self.label_4.setObjectName(u"label_4")

        self.horizontalLayout.addWidget(self.label_4)

        self.edit_State_Z = QLineEdit(self.groupBox_2)
        self.edit_State_Z.setObjectName(u"edit_State_Z")
        self.edit_State_Z.setReadOnly(True)

        self.horizontalLayout.addWidget(self.edit_State_Z)

        self.label_5 = QLabel(self.groupBox_2)
        self.label_5.setObjectName(u"label_5")

        self.horizontalLayout.addWidget(self.label_5)

        self.edit_State_Encode = QLineEdit(self.groupBox_2)
        self.edit_State_Encode.setObjectName(u"edit_State_Encode")
        self.edit_State_Encode.setReadOnly(True)

        self.horizontalLayout.addWidget(self.edit_State_Encode)

        self.groupBox_3 = QGroupBox(Form)
        self.groupBox_3.setObjectName(u"groupBox_3")
        self.groupBox_3.setGeometry(QRect(290, 59, 101, 61))
        sizePolicy.setHeightForWidth(self.groupBox_3.sizePolicy().hasHeightForWidth())
        self.groupBox_3.setSizePolicy(sizePolicy)
        self.verticalLayout = QVBoxLayout(self.groupBox_3)
        self.verticalLayout.setObjectName(u"verticalLayout")
        self.verticalLayout.setContentsMargins(-1, 0, -1, 6)
        self.label_6 = QLabel(self.groupBox_3)
        self.label_6.setObjectName(u"label_6")

        self.verticalLayout.addWidget(self.label_6)

        self.edit_State_Hand = QLineEdit(self.groupBox_3)
        self.edit_State_Hand.setObjectName(u"edit_State_Hand")
        self.edit_State_Hand.setAlignment(Qt.AlignCenter)
        self.edit_State_Hand.setReadOnly(True)

        self.verticalLayout.addWidget(self.edit_State_Hand)


        self.retranslateUi(Form)

        QMetaObject.connectSlotsByName(Form)
    # setupUi

    def retranslateUi(self, Form):
        Form.setWindowTitle(QCoreApplication.translate("Form", u"Form", None))
        self.groupBox.setTitle(QCoreApplication.translate("Form", u"\u8fde\u63a5\u63a7\u5236\u5668", None))
        self.label.setText(QCoreApplication.translate("Form", u"IP", None))
        self.comboBox.setCurrentText("")
        self.btn_close.setText(QCoreApplication.translate("Form", u"\u65ad\u5f00\u8fde\u63a5", None))
        self.btn_open.setText(QCoreApplication.translate("Form", u"\u8fde\u63a5", None))
        self.btn_ip_scan.setText(QCoreApplication.translate("Form", u"IP\u626b\u63cf", None))
        self.groupBox_4.setTitle(QCoreApplication.translate("Form", u"\u8f74\u9009\u62e9", None))
        self.radioButton_X.setText(QCoreApplication.translate("Form", u"X\u8f74", None))
        self.radioButton_Y.setText(QCoreApplication.translate("Form", u"Y\u8f74", None))
        self.radioButton_Z.setText(QCoreApplication.translate("Form", u"Z\u8f74", None))
        self.groupBox_5.setTitle(QCoreApplication.translate("Form", u"\u624b\u8f6e\u8bbe\u7f6e", None))
        self.groupBox_6.setTitle("")
        self.label_7.setText(QCoreApplication.translate("Form", u"\u8f74\u53f7 \uff1a  ", None))
        self.label_8.setText(QCoreApplication.translate("Form", u"\u500d\u7387 \uff1a", None))
        self.groupBox_7.setTitle("")
        self.radioButton_ABX.setText(QCoreApplication.translate("Form", u"AB\u76f8\u624b\u8f6e", None))
        self.radioButton_M_F.setText(QCoreApplication.translate("Form", u"\u8109\u51b2+\u65b9\u5411\u624b\u8f6e", None))
        self.groupBox_8.setTitle("")
        self.btn_Run.setText(QCoreApplication.translate("Form", u"\u624b\u8f6e\u94fe\u63a5", None))
        self.btn_Stop.setText(QCoreApplication.translate("Form", u"\u505c\u6b62", None))
        self.btn_clear.setText(QCoreApplication.translate("Form", u"\u4f4d\u7f6e\u6e05\u96f6", None))
        self.groupBox_2.setTitle(QCoreApplication.translate("Form", u"\u8f74\u72b6\u6001", None))
        self.label_2.setText(QCoreApplication.translate("Form", u"X\u8f74", None))
        self.label_3.setText(QCoreApplication.translate("Form", u"Y\u8f74", None))
        self.label_4.setText(QCoreApplication.translate("Form", u"Z\u8f74", None))
        self.label_5.setText(QCoreApplication.translate("Form", u"\u7f16\u7801\u8f74", None))
        self.groupBox_3.setTitle("")
        self.label_6.setText(QCoreApplication.translate("Form", u"\u624b\u8f6e\u8fde\u63a5\u72b6\u6001", None))
    # retranslateUi

