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
        Form.resize(612, 554)
        self.groupBox_4 = QGroupBox(Form)
        self.groupBox_4.setObjectName(u"groupBox_4")
        self.groupBox_4.setGeometry(QRect(0, 150, 191, 231))
        sizePolicy = QSizePolicy(QSizePolicy.Preferred, QSizePolicy.Preferred)
        sizePolicy.setHorizontalStretch(0)
        sizePolicy.setVerticalStretch(0)
        sizePolicy.setHeightForWidth(self.groupBox_4.sizePolicy().hasHeightForWidth())
        self.groupBox_4.setSizePolicy(sizePolicy)
        self.formLayout = QFormLayout(self.groupBox_4)
        self.formLayout.setObjectName(u"formLayout")
        self.label_6 = QLabel(self.groupBox_4)
        self.label_6.setObjectName(u"label_6")

        self.formLayout.setWidget(0, QFormLayout.LabelRole, self.label_6)

        self.edit_Units = QLineEdit(self.groupBox_4)
        self.edit_Units.setObjectName(u"edit_Units")

        self.formLayout.setWidget(0, QFormLayout.FieldRole, self.edit_Units)

        self.verticalSpacer = QSpacerItem(20, 40, QSizePolicy.Minimum, QSizePolicy.Expanding)

        self.formLayout.setItem(1, QFormLayout.LabelRole, self.verticalSpacer)

        self.label_7 = QLabel(self.groupBox_4)
        self.label_7.setObjectName(u"label_7")

        self.formLayout.setWidget(2, QFormLayout.LabelRole, self.label_7)

        self.edit_Lspeed = QLineEdit(self.groupBox_4)
        self.edit_Lspeed.setObjectName(u"edit_Lspeed")

        self.formLayout.setWidget(2, QFormLayout.FieldRole, self.edit_Lspeed)

        self.verticalSpacer_2 = QSpacerItem(20, 40, QSizePolicy.Minimum, QSizePolicy.Expanding)

        self.formLayout.setItem(3, QFormLayout.LabelRole, self.verticalSpacer_2)

        self.label_12 = QLabel(self.groupBox_4)
        self.label_12.setObjectName(u"label_12")

        self.formLayout.setWidget(4, QFormLayout.LabelRole, self.label_12)

        self.edit_CLSpeed = QLineEdit(self.groupBox_4)
        self.edit_CLSpeed.setObjectName(u"edit_CLSpeed")

        self.formLayout.setWidget(4, QFormLayout.FieldRole, self.edit_CLSpeed)

        self.verticalSpacer_3 = QSpacerItem(20, 40, QSizePolicy.Minimum, QSizePolicy.Expanding)

        self.formLayout.setItem(5, QFormLayout.LabelRole, self.verticalSpacer_3)

        self.label_8 = QLabel(self.groupBox_4)
        self.label_8.setObjectName(u"label_8")

        self.formLayout.setWidget(6, QFormLayout.LabelRole, self.label_8)

        self.edit_Speed = QLineEdit(self.groupBox_4)
        self.edit_Speed.setObjectName(u"edit_Speed")

        self.formLayout.setWidget(6, QFormLayout.FieldRole, self.edit_Speed)

        self.verticalSpacer_4 = QSpacerItem(20, 40, QSizePolicy.Minimum, QSizePolicy.Expanding)

        self.formLayout.setItem(7, QFormLayout.LabelRole, self.verticalSpacer_4)

        self.label_9 = QLabel(self.groupBox_4)
        self.label_9.setObjectName(u"label_9")

        self.formLayout.setWidget(8, QFormLayout.LabelRole, self.label_9)

        self.edit_Accel = QLineEdit(self.groupBox_4)
        self.edit_Accel.setObjectName(u"edit_Accel")

        self.formLayout.setWidget(8, QFormLayout.FieldRole, self.edit_Accel)

        self.verticalSpacer_5 = QSpacerItem(20, 40, QSizePolicy.Minimum, QSizePolicy.Expanding)

        self.formLayout.setItem(9, QFormLayout.LabelRole, self.verticalSpacer_5)

        self.label_10 = QLabel(self.groupBox_4)
        self.label_10.setObjectName(u"label_10")

        self.formLayout.setWidget(10, QFormLayout.LabelRole, self.label_10)

        self.edit_Decel = QLineEdit(self.groupBox_4)
        self.edit_Decel.setObjectName(u"edit_Decel")

        self.formLayout.setWidget(10, QFormLayout.FieldRole, self.edit_Decel)

        self.verticalSpacer_6 = QSpacerItem(20, 40, QSizePolicy.Minimum, QSizePolicy.Expanding)

        self.formLayout.setItem(11, QFormLayout.LabelRole, self.verticalSpacer_6)

        self.label_11 = QLabel(self.groupBox_4)
        self.label_11.setObjectName(u"label_11")

        self.formLayout.setWidget(12, QFormLayout.LabelRole, self.label_11)

        self.edit_zeroIO = QLineEdit(self.groupBox_4)
        self.edit_zeroIO.setObjectName(u"edit_zeroIO")

        self.formLayout.setWidget(12, QFormLayout.FieldRole, self.edit_zeroIO)

        self.groupBox_2 = QGroupBox(Form)
        self.groupBox_2.setObjectName(u"groupBox_2")
        self.groupBox_2.setGeometry(QRect(0, 60, 421, 91))
        self.gridLayout = QGridLayout(self.groupBox_2)
        self.gridLayout.setObjectName(u"gridLayout")
        self.label_5 = QLabel(self.groupBox_2)
        self.label_5.setObjectName(u"label_5")

        self.gridLayout.addWidget(self.label_5, 2, 3, 1, 1)

        self.lineEdit_Y = QLineEdit(self.groupBox_2)
        self.lineEdit_Y.setObjectName(u"lineEdit_Y")

        self.gridLayout.addWidget(self.lineEdit_Y, 0, 4, 1, 1)

        self.label_4 = QLabel(self.groupBox_2)
        self.label_4.setObjectName(u"label_4")

        self.gridLayout.addWidget(self.label_4, 2, 0, 1, 1)

        self.label_2 = QLabel(self.groupBox_2)
        self.label_2.setObjectName(u"label_2")

        self.gridLayout.addWidget(self.label_2, 0, 0, 1, 2)

        self.lineEdit_R = QLineEdit(self.groupBox_2)
        self.lineEdit_R.setObjectName(u"lineEdit_R")

        self.gridLayout.addWidget(self.lineEdit_R, 2, 4, 1, 1)

        self.label_3 = QLabel(self.groupBox_2)
        self.label_3.setObjectName(u"label_3")

        self.gridLayout.addWidget(self.label_3, 0, 3, 1, 1)

        self.lineEdit_Z = QLineEdit(self.groupBox_2)
        self.lineEdit_Z.setObjectName(u"lineEdit_Z")

        self.gridLayout.addWidget(self.lineEdit_Z, 2, 2, 1, 1)

        self.lineEdit_X = QLineEdit(self.groupBox_2)
        self.lineEdit_X.setObjectName(u"lineEdit_X")

        self.gridLayout.addWidget(self.lineEdit_X, 0, 2, 1, 1)

        self.btn_clearAll = QPushButton(self.groupBox_2)
        self.btn_clearAll.setObjectName(u"btn_clearAll")

        self.gridLayout.addWidget(self.btn_clearAll, 0, 5, 3, 1)

        self.groupBox_3 = QGroupBox(Form)
        self.groupBox_3.setObjectName(u"groupBox_3")
        self.groupBox_3.setGeometry(QRect(220, 150, 201, 111))
        self.gridLayout_2 = QGridLayout(self.groupBox_3)
        self.gridLayout_2.setObjectName(u"gridLayout_2")
        self.radio_Y = QRadioButton(self.groupBox_3)
        self.radio_Y.setObjectName(u"radio_Y")

        self.gridLayout_2.addWidget(self.radio_Y, 0, 1, 1, 1)

        self.radio_X = QRadioButton(self.groupBox_3)
        self.radio_X.setObjectName(u"radio_X")

        self.gridLayout_2.addWidget(self.radio_X, 0, 0, 1, 1)

        self.radio_R = QRadioButton(self.groupBox_3)
        self.radio_R.setObjectName(u"radio_R")

        self.gridLayout_2.addWidget(self.radio_R, 1, 1, 1, 1)

        self.radio_Z = QRadioButton(self.groupBox_3)
        self.radio_Z.setObjectName(u"radio_Z")

        self.gridLayout_2.addWidget(self.radio_Z, 1, 0, 1, 1)

        self.groupBox_6 = QGroupBox(Form)
        self.groupBox_6.setObjectName(u"groupBox_6")
        self.groupBox_6.setGeometry(QRect(0, 390, 211, 51))
        sizePolicy.setHeightForWidth(self.groupBox_6.sizePolicy().hasHeightForWidth())
        self.groupBox_6.setSizePolicy(sizePolicy)
        self.horizontalLayout = QHBoxLayout(self.groupBox_6)
        self.horizontalLayout.setObjectName(u"horizontalLayout")
        self.horizontalLayout.setContentsMargins(0, 0, 0, 0)
        self.btn_run = QPushButton(self.groupBox_6)
        self.btn_run.setObjectName(u"btn_run")

        self.horizontalLayout.addWidget(self.btn_run)

        self.btn_stop = QPushButton(self.groupBox_6)
        self.btn_stop.setObjectName(u"btn_stop")

        self.horizontalLayout.addWidget(self.btn_stop)

        self.btn_clear = QPushButton(self.groupBox_6)
        self.btn_clear.setObjectName(u"btn_clear")

        self.horizontalLayout.addWidget(self.btn_clear)

        self.groupBox = QGroupBox(Form)
        self.groupBox.setObjectName(u"groupBox")
        self.groupBox.setGeometry(QRect(0, 0, 421, 60))
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
        self.groupBox_5 = QGroupBox(Form)
        self.groupBox_5.setObjectName(u"groupBox_5")
        self.groupBox_5.setGeometry(QRect(220, 260, 201, 180))
        self.verticalLayout = QVBoxLayout(self.groupBox_5)
        self.verticalLayout.setObjectName(u"verticalLayout")
        self.radioButton_m1 = QRadioButton(self.groupBox_5)
        self.radioButton_m1.setObjectName(u"radioButton_m1")

        self.verticalLayout.addWidget(self.radioButton_m1)

        self.radioButton_m2 = QRadioButton(self.groupBox_5)
        self.radioButton_m2.setObjectName(u"radioButton_m2")

        self.verticalLayout.addWidget(self.radioButton_m2)

        self.radioButton_m3 = QRadioButton(self.groupBox_5)
        self.radioButton_m3.setObjectName(u"radioButton_m3")

        self.verticalLayout.addWidget(self.radioButton_m3)

        self.radioButton_m4 = QRadioButton(self.groupBox_5)
        self.radioButton_m4.setObjectName(u"radioButton_m4")

        self.verticalLayout.addWidget(self.radioButton_m4)

        self.radioButton_m5 = QRadioButton(self.groupBox_5)
        self.radioButton_m5.setObjectName(u"radioButton_m5")

        self.verticalLayout.addWidget(self.radioButton_m5)

        self.radioButton_m6 = QRadioButton(self.groupBox_5)
        self.radioButton_m6.setObjectName(u"radioButton_m6")

        self.verticalLayout.addWidget(self.radioButton_m6)


        self.retranslateUi(Form)

        QMetaObject.connectSlotsByName(Form)
    # setupUi

    def retranslateUi(self, Form):
        Form.setWindowTitle(QCoreApplication.translate("Form", u"Form", None))
        self.groupBox_4.setTitle(QCoreApplication.translate("Form", u"\u53c2\u6570\u8bbe\u7f6e", None))
        self.label_6.setText(QCoreApplication.translate("Form", u"\u8109\u51b2\u5f53\u91cf    ", None))
        self.label_7.setText(QCoreApplication.translate("Form", u"\u8d77\u59cb\u901f\u5ea6", None))
        self.label_12.setText(QCoreApplication.translate("Form", u"\u722c\u884c\u901f\u5ea6", None))
        self.label_8.setText(QCoreApplication.translate("Form", u"\u901f\u5ea6", None))
        self.label_9.setText(QCoreApplication.translate("Form", u"\u52a0\u901f\u5ea6", None))
        self.label_10.setText(QCoreApplication.translate("Form", u"\u51cf\u901f\u5ea6", None))
        self.label_11.setText(QCoreApplication.translate("Form", u"\u96f6\u70b9IO\u53e3", None))
        self.groupBox_2.setTitle(QCoreApplication.translate("Form", u"\u8f74\u72b6\u6001\u663e\u793a", None))
        self.label_5.setText(QCoreApplication.translate("Form", u"R\u8f74", None))
        self.label_4.setText(QCoreApplication.translate("Form", u"Z\u8f74", None))
        self.label_2.setText(QCoreApplication.translate("Form", u"X\u8f74    ", None))
        self.label_3.setText(QCoreApplication.translate("Form", u"Y\u8f74   ", None))
        self.btn_clearAll.setText(QCoreApplication.translate("Form", u"\u6240\u6709\u4f4d\u7f6e\u6e05\u96f6", None))
        self.groupBox_3.setTitle(QCoreApplication.translate("Form", u"\u8f74\u9009\u62e9", None))
        self.radio_Y.setText(QCoreApplication.translate("Form", u"Y", None))
        self.radio_X.setText(QCoreApplication.translate("Form", u"X", None))
        self.radio_R.setText(QCoreApplication.translate("Form", u"R", None))
        self.radio_Z.setText(QCoreApplication.translate("Form", u"Z", None))
        self.groupBox_6.setTitle("")
        self.btn_run.setText(QCoreApplication.translate("Form", u"\u8fd0\u884c", None))
        self.btn_stop.setText(QCoreApplication.translate("Form", u"\u505c\u6b62", None))
        self.btn_clear.setText(QCoreApplication.translate("Form", u"\u6e05\u96f6", None))
        self.groupBox.setTitle(QCoreApplication.translate("Form", u"\u8fde\u63a5\u63a7\u5236\u5668", None))
        self.label.setText(QCoreApplication.translate("Form", u"IP", None))
        self.comboBox.setCurrentText("")
        self.btn_close.setText(QCoreApplication.translate("Form", u"\u65ad\u5f00\u8fde\u63a5", None))
        self.btn_open.setText(QCoreApplication.translate("Form", u"\u8fde\u63a5", None))
        self.btn_ip_scan.setText(QCoreApplication.translate("Form", u"IP\u626b\u63cf", None))
        self.groupBox_5.setTitle(QCoreApplication.translate("Form", u"\u56de\u96f6\u6a21\u5f0f", None))
        self.radioButton_m1.setText(QCoreApplication.translate("Form", u"Z\u76f8\u6b63\u5411\u56de\u96f6", None))
        self.radioButton_m2.setText(QCoreApplication.translate("Form", u"Z\u76f8\u8d1f\u5411\u56de\u96f6", None))
        self.radioButton_m3.setText(QCoreApplication.translate("Form", u"\u539f\u70b9\u6b63\u5411\u56de\u96f6+\u53cd\u627e", None))
        self.radioButton_m4.setText(QCoreApplication.translate("Form", u"\u539f\u70b9\u8d1f\u5411\u56de\u96f6+\u53cd\u627e", None))
        self.radioButton_m5.setText(QCoreApplication.translate("Form", u"\u539f\u70b9\u6b63\u5411\u56de\u96f6", None))
        self.radioButton_m6.setText(QCoreApplication.translate("Form", u"\u539f\u70b9\u8d1f\u5411\u56de\u96f6", None))
    # retranslateUi

