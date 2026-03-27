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
        Form.resize(403, 462)
        self.groupBox_4 = QGroupBox(Form)
        self.groupBox_4.setObjectName(u"groupBox_4")
        self.groupBox_4.setGeometry(QRect(10, 200, 151, 261))
        sizePolicy = QSizePolicy(QSizePolicy.Preferred, QSizePolicy.Preferred)
        sizePolicy.setHorizontalStretch(0)
        sizePolicy.setVerticalStretch(0)
        sizePolicy.setHeightForWidth(self.groupBox_4.sizePolicy().hasHeightForWidth())
        self.groupBox_4.setSizePolicy(sizePolicy)
        self.label_5 = QLabel(self.groupBox_4)
        self.label_5.setObjectName(u"label_5")
        self.label_5.setGeometry(QRect(10, 22, 48, 16))
        self.label_6 = QLabel(self.groupBox_4)
        self.label_6.setObjectName(u"label_6")
        self.label_6.setGeometry(QRect(10, 64, 48, 16))
        self.edit_Units = QLineEdit(self.groupBox_4)
        self.edit_Units.setObjectName(u"edit_Units")
        self.edit_Units.setGeometry(QRect(70, 22, 71, 20))
        self.edit_Lspeed = QLineEdit(self.groupBox_4)
        self.edit_Lspeed.setObjectName(u"edit_Lspeed")
        self.edit_Lspeed.setGeometry(QRect(70, 64, 71, 20))
        self.edit_Speed = QLineEdit(self.groupBox_4)
        self.edit_Speed.setObjectName(u"edit_Speed")
        self.edit_Speed.setGeometry(QRect(70, 106, 71, 20))
        self.edit_Accel = QLineEdit(self.groupBox_4)
        self.edit_Accel.setObjectName(u"edit_Accel")
        self.edit_Accel.setGeometry(QRect(70, 147, 71, 20))
        self.edit_Decel = QLineEdit(self.groupBox_4)
        self.edit_Decel.setObjectName(u"edit_Decel")
        self.edit_Decel.setGeometry(QRect(70, 189, 71, 20))
        self.edit_Sramp = QLineEdit(self.groupBox_4)
        self.edit_Sramp.setObjectName(u"edit_Sramp")
        self.edit_Sramp.setGeometry(QRect(70, 231, 71, 20))
        self.label_7 = QLabel(self.groupBox_4)
        self.label_7.setObjectName(u"label_7")
        self.label_7.setGeometry(QRect(10, 106, 24, 16))
        self.label_8 = QLabel(self.groupBox_4)
        self.label_8.setObjectName(u"label_8")
        self.label_8.setGeometry(QRect(10, 147, 36, 16))
        self.label_9 = QLabel(self.groupBox_4)
        self.label_9.setObjectName(u"label_9")
        self.label_9.setGeometry(QRect(10, 189, 36, 16))
        self.label_10 = QLabel(self.groupBox_4)
        self.label_10.setObjectName(u"label_10")
        self.label_10.setGeometry(QRect(10, 231, 54, 16))
        self.groupBox_3 = QGroupBox(Form)
        self.groupBox_3.setObjectName(u"groupBox_3")
        self.groupBox_3.setGeometry(QRect(200, 80, 201, 111))
        self.gridLayout = QGridLayout(self.groupBox_3)
        self.gridLayout.setObjectName(u"gridLayout")
        self.radio_X = QRadioButton(self.groupBox_3)
        self.radio_X.setObjectName(u"radio_X")

        self.gridLayout.addWidget(self.radio_X, 0, 0, 1, 1)

        self.radio_Y = QRadioButton(self.groupBox_3)
        self.radio_Y.setObjectName(u"radio_Y")

        self.gridLayout.addWidget(self.radio_Y, 0, 1, 1, 1)

        self.radio_Z = QRadioButton(self.groupBox_3)
        self.radio_Z.setObjectName(u"radio_Z")

        self.gridLayout.addWidget(self.radio_Z, 1, 0, 1, 1)

        self.radio_R = QRadioButton(self.groupBox_3)
        self.radio_R.setObjectName(u"radio_R")

        self.gridLayout.addWidget(self.radio_R, 1, 1, 1, 1)

        self.groupBox_2 = QGroupBox(Form)
        self.groupBox_2.setObjectName(u"groupBox_2")
        self.groupBox_2.setGeometry(QRect(10, 80, 161, 111))
        self.formLayout = QFormLayout(self.groupBox_2)
        self.formLayout.setObjectName(u"formLayout")
        self.formLayout.setContentsMargins(-1, 9, 9, 9)
        self.label_2 = QLabel(self.groupBox_2)
        self.label_2.setObjectName(u"label_2")
        self.label_2.setMargin(5)

        self.formLayout.setWidget(0, QFormLayout.LabelRole, self.label_2)

        self.edit_State = QLineEdit(self.groupBox_2)
        self.edit_State.setObjectName(u"edit_State")
        self.edit_State.setReadOnly(True)

        self.formLayout.setWidget(0, QFormLayout.FieldRole, self.edit_State)

        self.label_3 = QLabel(self.groupBox_2)
        self.label_3.setObjectName(u"label_3")
        self.label_3.setMargin(5)

        self.formLayout.setWidget(1, QFormLayout.LabelRole, self.label_3)

        self.edit_Dpos = QLineEdit(self.groupBox_2)
        self.edit_Dpos.setObjectName(u"edit_Dpos")
        self.edit_Dpos.setReadOnly(True)

        self.formLayout.setWidget(1, QFormLayout.FieldRole, self.edit_Dpos)

        self.label_4 = QLabel(self.groupBox_2)
        self.label_4.setObjectName(u"label_4")
        self.label_4.setMargin(5)
        self.label_4.setIndent(-1)
        self.label_4.setOpenExternalLinks(False)

        self.formLayout.setWidget(2, QFormLayout.LabelRole, self.label_4)

        self.edit_Vspeed = QLineEdit(self.groupBox_2)
        self.edit_Vspeed.setObjectName(u"edit_Vspeed")
        self.edit_Vspeed.setReadOnly(True)

        self.formLayout.setWidget(2, QFormLayout.FieldRole, self.edit_Vspeed)

        self.groupBox = QGroupBox(Form)
        self.groupBox.setObjectName(u"groupBox")
        self.groupBox.setGeometry(QRect(0, 10, 400, 60))
        sizePolicy1 = QSizePolicy(QSizePolicy.Preferred, QSizePolicy.Fixed)
        sizePolicy1.setHorizontalStretch(0)
        sizePolicy1.setVerticalStretch(0)
        sizePolicy1.setHeightForWidth(self.groupBox.sizePolicy().hasHeightForWidth())
        self.groupBox.setSizePolicy(sizePolicy1)
        self.label = QLabel(self.groupBox)
        self.label.setObjectName(u"label")
        self.label.setGeometry(QRect(6, 22, 20, 20))
        sizePolicy2 = QSizePolicy(QSizePolicy.Fixed, QSizePolicy.Preferred)
        sizePolicy2.setHorizontalStretch(0)
        sizePolicy2.setVerticalStretch(0)
        sizePolicy2.setHeightForWidth(self.label.sizePolicy().hasHeightForWidth())
        self.label.setSizePolicy(sizePolicy2)
        self.comboBox = QComboBox(self.groupBox)
        self.comboBox.setObjectName(u"comboBox")
        self.comboBox.setGeometry(QRect(28, 20, 111, 23))
        sizePolicy3 = QSizePolicy(QSizePolicy.Fixed, QSizePolicy.Fixed)
        sizePolicy3.setHorizontalStretch(0)
        sizePolicy3.setVerticalStretch(0)
        sizePolicy3.setHeightForWidth(self.comboBox.sizePolicy().hasHeightForWidth())
        self.comboBox.setSizePolicy(sizePolicy3)
        self.comboBox.setEditable(True)
        self.btn_close = QPushButton(self.groupBox)
        self.btn_close.setObjectName(u"btn_close")
        self.btn_close.setGeometry(QRect(310, 20, 75, 23))
        sizePolicy3.setHeightForWidth(self.btn_close.sizePolicy().hasHeightForWidth())
        self.btn_close.setSizePolicy(sizePolicy3)
        self.btn_open = QPushButton(self.groupBox)
        self.btn_open.setObjectName(u"btn_open")
        self.btn_open.setGeometry(QRect(229, 20, 75, 23))
        sizePolicy3.setHeightForWidth(self.btn_open.sizePolicy().hasHeightForWidth())
        self.btn_open.setSizePolicy(sizePolicy3)
        self.btn_ip_scan = QPushButton(self.groupBox)
        self.btn_ip_scan.setObjectName(u"btn_ip_scan")
        self.btn_ip_scan.setGeometry(QRect(140, 20, 87, 23))
        self.groupBox_9 = QGroupBox(Form)
        self.groupBox_9.setObjectName(u"groupBox_9")
        self.groupBox_9.setGeometry(QRect(180, 400, 221, 61))
        self.horizontalLayout_3 = QHBoxLayout(self.groupBox_9)
        self.horizontalLayout_3.setObjectName(u"horizontalLayout_3")
        self.btn_Run = QPushButton(self.groupBox_9)
        self.btn_Run.setObjectName(u"btn_Run")

        self.horizontalLayout_3.addWidget(self.btn_Run)

        self.btn_Stop = QPushButton(self.groupBox_9)
        self.btn_Stop.setObjectName(u"btn_Stop")

        self.horizontalLayout_3.addWidget(self.btn_Stop)

        self.btn_Clear = QPushButton(self.groupBox_9)
        self.btn_Clear.setObjectName(u"btn_Clear")

        self.horizontalLayout_3.addWidget(self.btn_Clear)

        self.groupBox_5 = QGroupBox(Form)
        self.groupBox_5.setObjectName(u"groupBox_5")
        self.groupBox_5.setGeometry(QRect(180, 200, 221, 192))
        self.verticalLayout = QVBoxLayout(self.groupBox_5)
        self.verticalLayout.setObjectName(u"verticalLayout")
        self.groupBox_6 = QGroupBox(self.groupBox_5)
        self.groupBox_6.setObjectName(u"groupBox_6")
        self.horizontalLayout = QHBoxLayout(self.groupBox_6)
        self.horizontalLayout.setObjectName(u"horizontalLayout")
        self.radio_Zheng = QRadioButton(self.groupBox_6)
        self.radio_Zheng.setObjectName(u"radio_Zheng")

        self.horizontalLayout.addWidget(self.radio_Zheng)

        self.radio_fu = QRadioButton(self.groupBox_6)
        self.radio_fu.setObjectName(u"radio_fu")

        self.horizontalLayout.addWidget(self.radio_fu)

        self.verticalLayout.addWidget(self.groupBox_6)

        self.groupBox_7 = QGroupBox(self.groupBox_5)
        self.groupBox_7.setObjectName(u"groupBox_7")
        self.formLayout_4 = QFormLayout(self.groupBox_7)
        self.formLayout_4.setObjectName(u"formLayout_4")
        self.radio_Vmove = QRadioButton(self.groupBox_7)
        self.radio_Vmove.setObjectName(u"radio_Vmove")

        self.formLayout_4.setWidget(0, QFormLayout.LabelRole, self.radio_Vmove)

        self.radio_MoveAbs = QRadioButton(self.groupBox_7)
        self.radio_MoveAbs.setObjectName(u"radio_MoveAbs")

        self.formLayout_4.setWidget(0, QFormLayout.FieldRole, self.radio_MoveAbs)

        self.verticalLayout.addWidget(self.groupBox_7)

        self.groupBox_8 = QGroupBox(self.groupBox_5)
        self.groupBox_8.setObjectName(u"groupBox_8")
        self.horizontalLayout_2 = QHBoxLayout(self.groupBox_8)
        self.horizontalLayout_2.setObjectName(u"horizontalLayout_2")
        self.horizontalSpacer_2 = QSpacerItem(40, 20, QSizePolicy.Expanding, QSizePolicy.Minimum)

        self.horizontalLayout_2.addItem(self.horizontalSpacer_2)

        self.label_11 = QLabel(self.groupBox_8)
        self.label_11.setObjectName(u"label_11")

        self.horizontalLayout_2.addWidget(self.label_11)

        self.edit_Distance = QLineEdit(self.groupBox_8)
        self.edit_Distance.setObjectName(u"edit_Distance")

        self.horizontalLayout_2.addWidget(self.edit_Distance)

        self.horizontalSpacer_3 = QSpacerItem(40, 20, QSizePolicy.Expanding, QSizePolicy.Minimum)

        self.horizontalLayout_2.addItem(self.horizontalSpacer_3)

        self.horizontalSpacer = QSpacerItem(40, 20, QSizePolicy.Expanding, QSizePolicy.Minimum)

        self.horizontalLayout_2.addItem(self.horizontalSpacer)

        self.verticalLayout.addWidget(self.groupBox_8)

        self.retranslateUi(Form)

        QMetaObject.connectSlotsByName(Form)

    # setupUi

    def retranslateUi(self, Form):
        Form.setWindowTitle(QCoreApplication.translate("Form", u"Form", None))
        self.groupBox_4.setTitle(QCoreApplication.translate("Form", u"\u53c2\u6570\u8bbe\u7f6e", None))
        self.label_5.setText(QCoreApplication.translate("Form", u"\u8109\u51b2\u5f53\u91cf", None))
        self.label_6.setText(QCoreApplication.translate("Form", u"\u8d77\u59cb\u901f\u5ea6", None))
        self.label_7.setText(QCoreApplication.translate("Form", u"\u901f\u5ea6", None))
        self.label_8.setText(QCoreApplication.translate("Form", u"\u52a0\u901f\u5ea6", None))
        self.label_9.setText(QCoreApplication.translate("Form", u"\u51cf\u901f\u5ea6", None))
        self.label_10.setText(QCoreApplication.translate("Form", u"S\u66f2\u7ebf\u7a0b\u5ea6", None))
        self.groupBox_3.setTitle(QCoreApplication.translate("Form", u"\u8f74\u9009\u62e9", None))
        self.radio_X.setText(QCoreApplication.translate("Form", u"X", None))
        self.radio_Y.setText(QCoreApplication.translate("Form", u"Y", None))
        self.radio_Z.setText(QCoreApplication.translate("Form", u"Z", None))
        self.radio_R.setText(QCoreApplication.translate("Form", u"R", None))
        self.groupBox_2.setTitle(QCoreApplication.translate("Form", u"\u8f74\u72b6\u6001", None))
        self.label_2.setText(QCoreApplication.translate("Form", u"\u5f53\u524d\u72b6\u6001", None))
        self.label_3.setText(QCoreApplication.translate("Form", u"\u5f53\u524d\u4f4d\u7f6e", None))
        self.label_4.setText(QCoreApplication.translate("Form", u"\u5f53\u524d\u901f\u5ea6", None))
        self.groupBox.setTitle(QCoreApplication.translate("Form", u"\u8fde\u63a5\u63a7\u5236\u5668", None))
        self.label.setText(QCoreApplication.translate("Form", u"IP", None))
        self.comboBox.setCurrentText("")
        self.btn_close.setText(QCoreApplication.translate("Form", u"\u65ad\u5f00\u8fde\u63a5", None))
        self.btn_open.setText(QCoreApplication.translate("Form", u"\u8fde\u63a5", None))
        self.btn_ip_scan.setText(QCoreApplication.translate("Form", u"IP\u626b\u63cf", None))
        self.groupBox_9.setTitle("")
        self.btn_Run.setText(QCoreApplication.translate("Form", u"\u8fd0\u884c", None))
        self.btn_Stop.setText(QCoreApplication.translate("Form", u"\u505c\u6b62", None))
        self.btn_Clear.setText(QCoreApplication.translate("Form", u"\u6e05\u96f6", None))
        self.groupBox_5.setTitle(QCoreApplication.translate("Form", u"\u6a21\u5f0f\u9009\u62e9", None))
        self.groupBox_6.setTitle(QCoreApplication.translate("Form", u"\u6b63\u8d1f\u5411\u9009\u62e9", None))
        self.radio_Zheng.setText(QCoreApplication.translate("Form", u"\u6b63", None))
        self.radio_fu.setText(QCoreApplication.translate("Form", u"\u8d1f", None))
        self.groupBox_7.setTitle(QCoreApplication.translate("Form", u"\u8fd0\u52a8\u65b9\u5f0f", None))
        self.radio_Vmove.setText(QCoreApplication.translate("Form", u"\u6301\u7eed\u8fd0\u52a8", None))
        self.radio_MoveAbs.setText(QCoreApplication.translate("Form", u"\u76f8\u5bf9\u8fd0\u52a8", None))
        self.groupBox_8.setTitle("")
        self.label_11.setText(QCoreApplication.translate("Form", u"\u8fd0\u52a8\u8ddd\u79bb", None))
    # retranslateUi
