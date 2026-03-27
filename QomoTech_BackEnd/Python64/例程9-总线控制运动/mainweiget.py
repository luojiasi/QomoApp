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
        Form.resize(895, 475)
        self.groupBox = QGroupBox(Form)
        self.groupBox.setObjectName(u"groupBox")
        self.groupBox.setGeometry(QRect(0, 0, 531, 60))
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
        self.groupBox_2 = QGroupBox(Form)
        self.groupBox_2.setObjectName(u"groupBox_2")
        self.groupBox_2.setGeometry(QRect(0, 60, 276, 401))
        self.gridLayout = QGridLayout(self.groupBox_2)
        self.gridLayout.setObjectName(u"gridLayout")
        self.textEdit_file_path = QTextEdit(self.groupBox_2)
        self.textEdit_file_path.setObjectName(u"textEdit_file_path")

        self.gridLayout.addWidget(self.textEdit_file_path, 1, 0, 1, 2)

        self.btn_init_ZX = QPushButton(self.groupBox_2)
        self.btn_init_ZX.setObjectName(u"btn_init_ZX")

        self.gridLayout.addWidget(self.btn_init_ZX, 2, 0, 1, 2)

        self.label_4 = QLabel(self.groupBox_2)
        self.label_4.setObjectName(u"label_4")

        self.gridLayout.addWidget(self.label_4, 8, 0, 1, 1)

        self.edit_num_axis = QLineEdit(self.groupBox_2)
        self.edit_num_axis.setObjectName(u"edit_num_axis")

        self.gridLayout.addWidget(self.edit_num_axis, 8, 1, 1, 1)

        self.edit_num_node = QLineEdit(self.groupBox_2)
        self.edit_num_node.setObjectName(u"edit_num_node")

        self.gridLayout.addWidget(self.edit_num_node, 7, 1, 1, 1)

        self.btn_down_bas = QPushButton(self.groupBox_2)
        self.btn_down_bas.setObjectName(u"btn_down_bas")

        self.gridLayout.addWidget(self.btn_down_bas, 0, 0, 1, 2)

        self.label_3 = QLabel(self.groupBox_2)
        self.label_3.setObjectName(u"label_3")

        self.gridLayout.addWidget(self.label_3, 7, 0, 1, 1)

        self.label_2 = QLabel(self.groupBox_2)
        self.label_2.setObjectName(u"label_2")

        self.gridLayout.addWidget(self.label_2, 6, 0, 1, 1)

        self.edit_state_init = QLineEdit(self.groupBox_2)
        self.edit_state_init.setObjectName(u"edit_state_init")

        self.gridLayout.addWidget(self.edit_state_init, 6, 1, 1, 1)

        self.groupBox_3 = QGroupBox(Form)
        self.groupBox_3.setObjectName(u"groupBox_3")
        self.groupBox_3.setGeometry(QRect(280, 60, 251, 401))
        self.label_5 = QLabel(self.groupBox_3)
        self.label_5.setObjectName(u"label_5")
        self.label_5.setGeometry(QRect(10, 29, 24, 16))
        self.label_6 = QLabel(self.groupBox_3)
        self.label_6.setObjectName(u"label_6")
        self.label_6.setGeometry(QRect(10, 62, 36, 16))
        self.label_7 = QLabel(self.groupBox_3)
        self.label_7.setObjectName(u"label_7")
        self.label_7.setGeometry(QRect(10, 95, 48, 16))
        self.label_8 = QLabel(self.groupBox_3)
        self.label_8.setObjectName(u"label_8")
        self.label_8.setGeometry(QRect(10, 131, 48, 16))
        self.label_11 = QLabel(self.groupBox_3)
        self.label_11.setObjectName(u"label_11")
        self.label_11.setGeometry(QRect(10, 230, 48, 16))
        self.label_12 = QLabel(self.groupBox_3)
        self.label_12.setObjectName(u"label_12")
        self.label_12.setGeometry(QRect(10, 263, 48, 16))
        self.label_13 = QLabel(self.groupBox_3)
        self.label_13.setObjectName(u"label_13")
        self.label_13.setGeometry(QRect(10, 296, 48, 16))
        self.label_14 = QLabel(self.groupBox_3)
        self.label_14.setObjectName(u"label_14")
        self.label_14.setGeometry(QRect(10, 329, 36, 16))
        self.edit_units = QLineEdit(self.groupBox_3)
        self.edit_units.setObjectName(u"edit_units")
        self.edit_units.setGeometry(QRect(65, 131, 81, 20))
        self.edit_speed = QLineEdit(self.groupBox_3)
        self.edit_speed.setObjectName(u"edit_speed")
        self.edit_speed.setGeometry(QRect(65, 164, 81, 20))
        self.edit_accle = QLineEdit(self.groupBox_3)
        self.edit_accle.setObjectName(u"edit_accle")
        self.edit_accle.setGeometry(QRect(65, 197, 81, 20))
        self.edit_dpos = QLineEdit(self.groupBox_3)
        self.edit_dpos.setObjectName(u"edit_dpos")
        self.edit_dpos.setGeometry(QRect(65, 230, 81, 20))
        self.edit_mpos = QLineEdit(self.groupBox_3)
        self.edit_mpos.setObjectName(u"edit_mpos")
        self.edit_mpos.setGeometry(QRect(65, 263, 81, 20))
        self.edit_state_sport = QLineEdit(self.groupBox_3)
        self.edit_state_sport.setObjectName(u"edit_state_sport")
        self.edit_state_sport.setGeometry(QRect(65, 296, 81, 20))
        self.edit_state_axis = QLineEdit(self.groupBox_3)
        self.edit_state_axis.setObjectName(u"edit_state_axis")
        self.edit_state_axis.setGeometry(QRect(65, 330, 81, 20))
        self.edit_axis = QLineEdit(self.groupBox_3)
        self.edit_axis.setObjectName(u"edit_axis")
        self.edit_axis.setGeometry(QRect(65, 29, 81, 20))
        self.edit_atype_axis = QLineEdit(self.groupBox_3)
        self.edit_atype_axis.setObjectName(u"edit_atype_axis")
        self.edit_atype_axis.setGeometry(QRect(65, 62, 81, 20))
        self.edit_state_enable = QLineEdit(self.groupBox_3)
        self.edit_state_enable.setObjectName(u"edit_state_enable")
        self.edit_state_enable.setGeometry(QRect(65, 96, 81, 20))
        self.label_9 = QLabel(self.groupBox_3)
        self.label_9.setObjectName(u"label_9")
        self.label_9.setGeometry(QRect(10, 164, 24, 16))
        self.label_10 = QLabel(self.groupBox_3)
        self.label_10.setObjectName(u"label_10")
        self.label_10.setGeometry(QRect(10, 197, 36, 16))
        self.btn_enable = QPushButton(self.groupBox_3)
        self.btn_enable.setObjectName(u"btn_enable")
        self.btn_enable.setGeometry(QRect(172, 95, 69, 23))
        self.btn_clear_warning = QPushButton(self.groupBox_3)
        self.btn_clear_warning.setObjectName(u"btn_clear_warning")
        self.btn_clear_warning.setGeometry(QRect(172, 329, 69, 23))
        self.btn_fwd = QPushButton(self.groupBox_3)
        self.btn_fwd.setObjectName(u"btn_fwd")
        self.btn_fwd.setGeometry(QRect(10, 365, 69, 23))
        self.btn_rev = QPushButton(self.groupBox_3)
        self.btn_rev.setObjectName(u"btn_rev")
        self.btn_rev.setGeometry(QRect(97, 365, 69, 23))
        self.btn_stop = QPushButton(self.groupBox_3)
        self.btn_stop.setObjectName(u"btn_stop")
        self.btn_stop.setGeometry(QRect(172, 365, 69, 23))
        self.groupBox_4 = QGroupBox(Form)
        self.groupBox_4.setObjectName(u"groupBox_4")
        self.groupBox_4.setGeometry(QRect(540, 0, 331, 151))
        self.gridLayout_2 = QGridLayout(self.groupBox_4)
        self.gridLayout_2.setObjectName(u"gridLayout_2")
        self.edit_HL_low = QLineEdit(self.groupBox_4)
        self.edit_HL_low.setObjectName(u"edit_HL_low")

        self.gridLayout_2.addWidget(self.edit_HL_low, 3, 1, 1, 1)

        self.label_16 = QLabel(self.groupBox_4)
        self.label_16.setObjectName(u"label_16")

        self.gridLayout_2.addWidget(self.label_16, 2, 0, 1, 1)

        self.label_17 = QLabel(self.groupBox_4)
        self.label_17.setObjectName(u"label_17")

        self.gridLayout_2.addWidget(self.label_17, 3, 0, 1, 1)

        self.edit_HL_offset = QLineEdit(self.groupBox_4)
        self.edit_HL_offset.setObjectName(u"edit_HL_offset")

        self.gridLayout_2.addWidget(self.edit_HL_offset, 4, 1, 1, 1)

        self.edit_HL_high = QLineEdit(self.groupBox_4)
        self.edit_HL_high.setObjectName(u"edit_HL_high")

        self.gridLayout_2.addWidget(self.edit_HL_high, 2, 1, 1, 1)

        self.label_18 = QLabel(self.groupBox_4)
        self.label_18.setObjectName(u"label_18")

        self.gridLayout_2.addWidget(self.label_18, 4, 0, 1, 1)

        self.edit_HL_mode = QLineEdit(self.groupBox_4)
        self.edit_HL_mode.setObjectName(u"edit_HL_mode")

        self.gridLayout_2.addWidget(self.edit_HL_mode, 0, 1, 1, 1)

        self.label_19 = QLabel(self.groupBox_4)
        self.label_19.setObjectName(u"label_19")

        self.gridLayout_2.addWidget(self.label_19, 0, 4, 1, 1)

        self.label_15 = QLabel(self.groupBox_4)
        self.label_15.setObjectName(u"label_15")

        self.gridLayout_2.addWidget(self.label_15, 0, 0, 1, 1)

        self.edit_HL_state = QLineEdit(self.groupBox_4)
        self.edit_HL_state.setObjectName(u"edit_HL_state")

        self.gridLayout_2.addWidget(self.edit_HL_state, 0, 5, 1, 1)

        self.btn_HL_start = QPushButton(self.groupBox_4)
        self.btn_HL_start.setObjectName(u"btn_HL_start")

        self.gridLayout_2.addWidget(self.btn_HL_start, 3, 4, 1, 2)

        self.btn_HL_stop = QPushButton(self.groupBox_4)
        self.btn_HL_stop.setObjectName(u"btn_HL_stop")

        self.gridLayout_2.addWidget(self.btn_HL_stop, 4, 4, 1, 2)

        self.groupBox_5 = QGroupBox(Form)
        self.groupBox_5.setObjectName(u"groupBox_5")
        self.groupBox_5.setGeometry(QRect(540, 150, 331, 311))
        self.groupBox_6 = QGroupBox(self.groupBox_5)
        self.groupBox_6.setObjectName(u"groupBox_6")
        self.groupBox_6.setGeometry(QRect(0, 24, 331, 131))
        self.label_20 = QLabel(self.groupBox_6)
        self.label_20.setObjectName(u"label_20")
        self.label_20.setGeometry(QRect(10, 22, 36, 16))
        self.label_22 = QLabel(self.groupBox_6)
        self.label_22.setObjectName(u"label_22")
        self.label_22.setGeometry(QRect(143, 22, 36, 16))
        self.label_24 = QLabel(self.groupBox_6)
        self.label_24.setObjectName(u"label_24")
        self.label_24.setGeometry(QRect(275, 22, 24, 16))
        self.edit_node_1 = QLineEdit(self.groupBox_6)
        self.edit_node_1.setObjectName(u"edit_node_1")
        self.edit_node_1.setGeometry(QRect(10, 40, 46, 20))
        self.edit_dir_1 = QLineEdit(self.groupBox_6)
        self.edit_dir_1.setObjectName(u"edit_dir_1")
        self.edit_dir_1.setGeometry(QRect(62, 40, 75, 20))
        self.edit_sub_node_1 = QLineEdit(self.groupBox_6)
        self.edit_sub_node_1.setObjectName(u"edit_sub_node_1")
        self.edit_sub_node_1.setGeometry(QRect(143, 40, 45, 20))
        self.edit_date_1 = QLineEdit(self.groupBox_6)
        self.edit_date_1.setObjectName(u"edit_date_1")
        self.edit_date_1.setGeometry(QRect(260, 40, 61, 20))
        self.comboBox_type_1 = QComboBox(self.groupBox_6)
        self.comboBox_type_1.setObjectName(u"comboBox_type_1")
        self.comboBox_type_1.setGeometry(QRect(194, 40, 61, 20))
        self.comboBox_type_2 = QComboBox(self.groupBox_6)
        self.comboBox_type_2.setObjectName(u"comboBox_type_2")
        self.comboBox_type_2.setGeometry(QRect(194, 66, 61, 20))
        self.edit_dir_2 = QLineEdit(self.groupBox_6)
        self.edit_dir_2.setObjectName(u"edit_dir_2")
        self.edit_dir_2.setGeometry(QRect(62, 66, 75, 20))
        self.edit_node_2 = QLineEdit(self.groupBox_6)
        self.edit_node_2.setObjectName(u"edit_node_2")
        self.edit_node_2.setGeometry(QRect(10, 66, 46, 20))
        self.edit_date_2 = QLineEdit(self.groupBox_6)
        self.edit_date_2.setObjectName(u"edit_date_2")
        self.edit_date_2.setGeometry(QRect(260, 66, 61, 20))
        self.edit_sub_node_2 = QLineEdit(self.groupBox_6)
        self.edit_sub_node_2.setObjectName(u"edit_sub_node_2")
        self.edit_sub_node_2.setGeometry(QRect(143, 66, 45, 20))
        self.btn_Ecat_read = QPushButton(self.groupBox_6)
        self.btn_Ecat_read.setObjectName(u"btn_Ecat_read")
        self.btn_Ecat_read.setGeometry(QRect(62, 92, 75, 23))
        self.btn_Ecat_write = QPushButton(self.groupBox_6)
        self.btn_Ecat_write.setObjectName(u"btn_Ecat_write")
        self.btn_Ecat_write.setGeometry(QRect(194, 92, 75, 23))
        self.label_23 = QLabel(self.groupBox_6)
        self.label_23.setObjectName(u"label_23")
        self.label_23.setGeometry(QRect(194, 22, 48, 16))
        self.label_21 = QLabel(self.groupBox_6)
        self.label_21.setObjectName(u"label_21")
        self.label_21.setGeometry(QRect(62, 22, 48, 16))
        self.groupBox_7 = QGroupBox(self.groupBox_5)
        self.groupBox_7.setObjectName(u"groupBox_7")
        self.groupBox_7.setGeometry(QRect(0, 170, 331, 121))
        self.gridLayout_4 = QGridLayout(self.groupBox_7)
        self.gridLayout_4.setObjectName(u"gridLayout_4")
        self.label_25 = QLabel(self.groupBox_7)
        self.label_25.setObjectName(u"label_25")

        self.gridLayout_4.addWidget(self.label_25, 0, 0, 1, 1)

        self.label_26 = QLabel(self.groupBox_7)
        self.label_26.setObjectName(u"label_26")

        self.gridLayout_4.addWidget(self.label_26, 0, 1, 1, 1)

        self.label_27 = QLabel(self.groupBox_7)
        self.label_27.setObjectName(u"label_27")

        self.gridLayout_4.addWidget(self.label_27, 0, 2, 1, 1)

        self.edit_Rtex_axis_1 = QLineEdit(self.groupBox_7)
        self.edit_Rtex_axis_1.setObjectName(u"edit_Rtex_axis_1")

        self.gridLayout_4.addWidget(self.edit_Rtex_axis_1, 1, 0, 1, 1)

        self.edit_add_1 = QLineEdit(self.groupBox_7)
        self.edit_add_1.setObjectName(u"edit_add_1")

        self.gridLayout_4.addWidget(self.edit_add_1, 1, 1, 1, 1)

        self.edit_date_3 = QLineEdit(self.groupBox_7)
        self.edit_date_3.setObjectName(u"edit_date_3")

        self.gridLayout_4.addWidget(self.edit_date_3, 1, 2, 1, 1)

        self.btn_Rtex_read = QPushButton(self.groupBox_7)
        self.btn_Rtex_read.setObjectName(u"btn_Rtex_read")

        self.gridLayout_4.addWidget(self.btn_Rtex_read, 1, 3, 1, 1)

        self.edit_Rtex_axis_2 = QLineEdit(self.groupBox_7)
        self.edit_Rtex_axis_2.setObjectName(u"edit_Rtex_axis_2")

        self.gridLayout_4.addWidget(self.edit_Rtex_axis_2, 2, 0, 1, 1)

        self.edit_add_2 = QLineEdit(self.groupBox_7)
        self.edit_add_2.setObjectName(u"edit_add_2")

        self.gridLayout_4.addWidget(self.edit_add_2, 2, 1, 1, 1)

        self.edit_date_4 = QLineEdit(self.groupBox_7)
        self.edit_date_4.setObjectName(u"edit_date_4")

        self.gridLayout_4.addWidget(self.edit_date_4, 2, 2, 1, 1)

        self.btn_Rtex_write = QPushButton(self.groupBox_7)
        self.btn_Rtex_write.setObjectName(u"btn_Rtex_write")

        self.gridLayout_4.addWidget(self.btn_Rtex_write, 2, 3, 1, 1)

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
        self.groupBox_2.setTitle(QCoreApplication.translate("Form", u"\u603b\u7ebf\u521d\u59cb\u5316", None))
        self.btn_init_ZX.setText(QCoreApplication.translate("Form", u"\u603b\u7ebf\u521d\u59cb\u5316", None))
        self.label_4.setText(QCoreApplication.translate("Form", u"     \u8f74\u6570\u91cf", None))
        self.btn_down_bas.setText(
            QCoreApplication.translate("Form", u"\u4e0b\u8f7dbas\u521d\u59cb\u5316\u7a0b\u5e8f", None))
        self.label_3.setText(QCoreApplication.translate("Form", u"    \u8282\u70b9\u6570\u91cf", None))
        self.label_2.setText(QCoreApplication.translate("Form", u"   \u521d\u59cb\u5316\u72b6\u6001    ", None))
        self.groupBox_3.setTitle(QCoreApplication.translate("Form", u"\u8f74\u8fd0\u52a8", None))
        self.label_5.setText(QCoreApplication.translate("Form", u"\u8f74\u53f7", None))
        self.label_6.setText(QCoreApplication.translate("Form", u"\u8f74\u7c7b\u578b", None))
        self.label_7.setText(QCoreApplication.translate("Form", u"\u4f7f\u80fd\u72b6\u6001", None))
        self.label_8.setText(QCoreApplication.translate("Form", u"\u8109\u51b2\u5f53\u91cf", None))
        self.label_11.setText(QCoreApplication.translate("Form", u"\u547d\u4ee4\u4f4d\u7f6e", None))
        self.label_12.setText(QCoreApplication.translate("Form", u"\u53cd\u9988\u4f4d\u7f6e", None))
        self.label_13.setText(QCoreApplication.translate("Form", u"\u8fd0\u52a8\u72b6\u6001", None))
        self.label_14.setText(QCoreApplication.translate("Form", u"\u8f74\u72b6\u6001", None))
        self.label_9.setText(QCoreApplication.translate("Form", u"\u901f\u5ea6", None))
        self.label_10.setText(QCoreApplication.translate("Form", u"\u52a0\u901f\u5ea6", None))
        self.btn_enable.setText(QCoreApplication.translate("Form", u"\u6253\u5f00/\u5173\u95ed", None))
        self.btn_clear_warning.setText(QCoreApplication.translate("Form", u"\u6e05\u9664\u8b66\u62a5", None))
        self.btn_fwd.setText(QCoreApplication.translate("Form", u"\u6b63\u8f6c", None))
        self.btn_rev.setText(QCoreApplication.translate("Form", u"\u53cd\u8f6c", None))
        self.btn_stop.setText(QCoreApplication.translate("Form", u"\u505c\u6b62", None))
        self.groupBox_4.setTitle(QCoreApplication.translate("Form", u"\u603b\u7ebf\u56de\u96f6", None))
        self.label_16.setText(QCoreApplication.translate("Form", u"\u56de\u96f6\u9ad8\u901f", None))
        self.label_17.setText(QCoreApplication.translate("Form", u"\u56de\u96f6\u4f4e\u901f", None))
        self.label_18.setText(QCoreApplication.translate("Form", u"\u56de\u96f6\u504f\u79fb", None))
        self.label_19.setText(QCoreApplication.translate("Form", u"\u56de\u96f6\u72b6\u6001", None))
        self.label_15.setText(QCoreApplication.translate("Form", u"\u56de\u96f6\u6a21\u5f0f", None))
        self.btn_HL_start.setText(QCoreApplication.translate("Form", u"\u542f\u52a8\u56de\u96f6", None))
        self.btn_HL_stop.setText(QCoreApplication.translate("Form", u"\u505c\u6b62", None))
        self.groupBox_5.setTitle(QCoreApplication.translate("Form", u"\u603b\u7ebf\u6570\u636e\u4ea4\u4e92", None))
        self.groupBox_6.setTitle(QCoreApplication.translate("Form", u"etherCAT", None))
        self.label_20.setText(QCoreApplication.translate("Form", u"\u8282\u70b9\u53f7", None))
        self.label_22.setText(QCoreApplication.translate("Form", u"\u5b50\u7f16\u53f7", None))
        self.label_24.setText(QCoreApplication.translate("Form", u"\u6570\u636e", None))
        self.btn_Ecat_read.setText(QCoreApplication.translate("Form", u"\u8bfb", None))
        self.btn_Ecat_write.setText(QCoreApplication.translate("Form", u"\u5199", None))
        self.label_23.setText(QCoreApplication.translate("Form", u"\u6570\u636e\u7c7b\u578b", None))
        self.label_21.setText(QCoreApplication.translate("Form", u"\u5bf9\u8c61\u5b57\u5178", None))
        self.groupBox_7.setTitle(QCoreApplication.translate("Form", u"RTEX", None))
        self.label_25.setText(QCoreApplication.translate("Form", u"\u8f74\u53f7", None))
        self.label_26.setText(QCoreApplication.translate("Form", u"\u53c2\u6570\u5730\u5740", None))
        self.label_27.setText(QCoreApplication.translate("Form", u"\u6570\u636e", None))
        self.btn_Rtex_read.setText(QCoreApplication.translate("Form", u"\u8bfb", None))
        self.btn_Rtex_write.setText(QCoreApplication.translate("Form", u"\u5199", None))
    # retranslateUi
