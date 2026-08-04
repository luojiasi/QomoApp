<template>
  <div class="h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
    <input
      ref="importFileInputRef"
      type="file"
      accept=".ljs,.dxf"
      class="hidden"
      @change="handleImportFileChange"
    />
    <!-- 顶部工具栏 -->
    <header class="h-12 w-full border-b border-slate-800 bg-slate-900/60 backdrop-blur">
      <div class="relative flex h-full items-center justify-between px-3">
        <div class="relative px-2 flex items-center gap-2">
          <!-- 左上角：文件菜单按钮 -->
          <button
            ref="fileBtnRef"
            type="button"
            class="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800/60 px-2 py-1 text-xs hover:bg-slate-800"
            @click.stop="toggleFileMenu"
          >
            文件
            <span class="text-[10px] opacity-80">▾</span>
          </button>
          <input type="text" v-model="projectName" class="text-xs text-slate-200 bg-slate-900/60" />
        </div>

        <!-- 工具栏中间：四个文字按钮 -->
        <div class="absolute left-1/2 flex -translate-x-1/2 items-center justify-center gap-6 px-4">
          <button
            v-for="toolButton in toolButtons"
            :key="toolButton.id"
            type="button"
            class="rounded-md border px-3 py-1 text-xs transition-colors"
            :class="
              toolButton.selected
                ? 'border-white bg-slate-800 text-white'
                : 'border-transparent text-slate-200 hover:border-slate-600 hover:bg-slate-800/40 hover:text-white'
            "
            @click="selectToolButton(toolButton.id)"
          >
            {{ toolButton.name }}
          </button>
        </div>

        <div class="flex items-center gap-2 px-30">
          <RouterLink
            to="/home"
            class="rounded-md border border-red-700/30 bg-blue-700 px-2 py-1 text-xs hover:bg-red-800 hover:border-blue-700"
          >
            返回首页
          </RouterLink>
          <div class="mx-1 h-5 w-px bg-slate-700"></div>
          <button
            type="button"
            class="rounded-md border border-slate-700 bg-slate-800/60 px-2 py-1 text-xs hover:bg-slate-800"
            @click="handleCanvasUndo"
          >
            撤销
          </button>
          <button
            type="button"
            @click="handleCanvasRedo"
            class="rounded-md border border-slate-700 bg-slate-800/60 px-2 py-1 text-xs hover:bg-slate-800"
          >
            重做
          </button>
        </div>
      </div>
    </header>

    <!-- 详细操作功能区（CAD 工具条风格） -->
    <section class="h-20 w-full border-b border-slate-800 bg-slate-900/30">
      <div class="flex px-1.5 py-1.5 items-center gap-1">
        <!-- 绘图工具面板 -->
        <div
          v-if="toolButtons.find((b) => b.selected)?.id === 1"
          class="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/60 px-2 py-2 shadow-sm shadow-black/20"
        >
          <div
            class="text-xs font-medium text-slate-200 [writing-mode:vertical-rl] [text-orientation:mixed] tracking-wide"
          >
            绘图
          </div>
          <div class="mx-1 h-10 w-px bg-slate-700/70"></div>

          <div class="flex items-center gap-3">
            <button
              v-for="tool in canvas2dTools.drawing"
              :key="tool.id"
              type="button"
              class="group relative flex h-12 w-16 flex-col items-center justify-center rounded-md border text-slate-200 transition-colors hover:bg-slate-800/60"
              :class="
                canvas2dActiveToolId === tool.id
                  ? 'border-white bg-slate-800/80'
                  : 'border-transparent hover:border-slate-600'
              "
              @click="selectCanvas2DTool(tool.id)"
              @mouseenter="onCanvas2DDrawingToolMouseEnter(tool, $event)"
              @mouseleave="onCanvas2DDrawingToolMouseLeave"
            >
              <svg
                class="h-5 w-5 text-slate-200"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                :stroke-linecap="tool.svgStrokeLinecap"
              >
                <template v-for="(shape, si) in tool.shapes" :key="si">
                  <path v-if="shape.kind === 'path'" :d="shape.d" />
                  <ellipse
                    v-else-if="shape.kind === 'ellipse'"
                    :cx="shape.cx"
                    :cy="shape.cy"
                    :rx="shape.rx"
                    :ry="shape.ry"
                    :fill="shape.fill ? 'currentColor' : 'none'"
                    :stroke="shape.fill ? 'none' : 'currentColor'"
                  />
                  <circle
                    v-else
                    :cx="shape.cx"
                    :cy="shape.cy"
                    :r="shape.r"
                    :fill="shape.fill ? 'currentColor' : 'none'"
                    :stroke="shape.fill ? 'none' : 'currentColor'"
                  />
                </template>
              </svg>
              <div class="mt-1 text-[11px] text-slate-200">{{ tool.name }}</div>
              <div
                v-if="tool.DrawingShapeTools && tool.DrawingShapeTools.length >= 2"
                class="absolute -bottom-1 right-1 text-[14px] leading-none text-slate-400"
              >
                ▾
              </div>
            </button>
          </div>
        </div>

        <!-- 2D复杂图形运算 -->
        <div
          v-if="toolButtons.find((b) => b.selected)?.id === 1"
          class="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/60 px-2 py-2 shadow-sm shadow-black/20"
        >
          <div
            class="text-xs font-medium text-slate-200 [writing-mode:vertical-rl] [text-orientation:mixed] tracking-wide"
          >
            修改
          </div>
          <div class="mx-1 h-10 w-px bg-slate-700/70"></div>

          <div class="flex items-center gap-3">
            <button
              v-for="tool in canvas2dTools.complexfunction"
              :key="tool.id"
              type="button"
              class="group relative flex h-12 w-16 flex-col items-center justify-center rounded-md border text-slate-200 transition-colors hover:bg-slate-800/60"
              :class="
                canvas2dActiveToolId === tool.id
                  ? 'border-white bg-slate-800/80'
                  : 'border-transparent hover:border-slate-600'
              "
              @mouseenter="onCanvas2DDrawingToolMouseEnter(tool, $event)"
              @mouseleave="onCanvas2DDrawingToolMouseLeave"
            >
              <!-- <svg 
                class="h-5 w-5 text-slate-200"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                :stroke-linecap="tool.svgStrokeLinecap"
              >
                <template v-for="(shape, si) in tool.shapes" :key="si">
                  <path v-if="shape.kind === 'path'" :d="shape.d" />
                  <circle
                    v-else
                    :cx="shape.cx"
                    :cy="shape.cy"
                    :r="shape.r"
                    :fill="shape.fill ? 'currentColor' : 'none'"
                    :stroke="shape.fill ? 'none' : 'currentColor'"
                  />
                </template>
              </svg> -->
              <div class="mt-1 text-[11px] text-slate-200">{{ tool.name }}</div>
              <!-- <div v-if="tool.DrawingShapeTools && tool.DrawingShapeTools.length >=2 " class="absolute -bottom-1 right-1 text-[14px] leading-none text-slate-400">▾</div> -->
            </button>
            <button
              type="button"
              class="group relative flex h-12 w-16 flex-col items-center justify-center rounded-md border border-transparent text-slate-200 transition-colors hover:border-slate-600 hover:bg-slate-800/60"
              title="重置 Home 展示图 Shift 偏移"
              @click="resetShowImageOffset"
            >
              <div class="mt-1 text-[11px] text-slate-200">重置偏移</div>
            </button>
            <label
              class="flex h-12 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-md border border-transparent px-1 text-[11px] text-slate-200 hover:border-slate-600 hover:bg-slate-800/60"
              title="运行时将展示偏移 X 取反后叠加到 xyOffset"
            >
              <input v-model="invertShowImageOffsetX" type="checkbox" class="accent-sky-400" />
              反转X
            </label>
            <label
              class="flex h-12 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-md border border-transparent px-1 text-[11px] text-slate-200 hover:border-slate-600 hover:bg-slate-800/60"
              title="运行时将展示偏移 Y 取反后叠加到 xyOffset"
            >
              <input v-model="invertShowImageOffsetY" type="checkbox" class="accent-sky-400" />
              反转Y
            </label>
          </div>
        </div>




        <!-- 参数信息面板（与绘图工具同级展示，无滚动条） -->
        <div
          v-else-if="toolButtons.find((b) => b.selected)?.id === 2"
          class="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/60 px-2 py-2 shadow-sm shadow-black/20"
        >
          <div
            class="text-xs font-medium text-slate-200 [writing-mode:vertical-rl] [text-orientation:mixed] tracking-wide"
          >
            参数
          </div>
          <div class="mx-1 h-10 w-px bg-slate-700/70"></div>

          <div class="flex flex-1 items-center gap-3 text-xs text-slate-100">
            <div v-if="selectedEntities.length === 0" class="text-slate-400">
              当前未选中任何实体，请在左侧 2D 视图中框选或点击实体。
            </div>

            <template v-else>
              <div
                v-for="(entity, index) in selectedEntities"
                :key="entity.id"
                class="flex flex-col gap-0.5 rounded-md border border-slate-700/80 bg-slate-900/60 px-2 py-1"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="flex items-center gap-2 min-w-0">
                    <span class="font-semibold text-sky-300 whitespace-nowrap">
                      实体 {{ index + 1 }}（{{ entity.type }}）
                    </span>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="text-[10px] text-slate-500 truncate max-w-[120px]">
                      ID: {{ entity.id }}
                    </span>
                    <button
                      type="button"
                      class="rounded border border-slate-700 bg-slate-800/40 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-800"
                      @click.stop="openEditParams(entity)"
                    >
                      编辑参数
                    </button>
                  </div>
                </div>

                <div v-if="entity.type === 'LINE'" class="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                  <span>图层：{{ entity.layerName }}</span>
                  <span>开口方向：{{ entity.openDirection }}</span>
                  <span>基准高：{{ entity.baseHeight }}</span>
                  <span>表面角：{{ entity.surfaceAngle ?? 0 }}</span>
                  <span>挤出高：{{ entity.extrudeHeight }}</span>
                  <template
                    v-if="
                      editingLinePoint?.entityId === entity.id &&
                      editingLinePoint?.which === 'start'
                    "
                  >
                    <span class="inline-flex items-center gap-1">
                      起点：
                      <input
                        ref="linePointInputRef"
                        v-model.number="linePointEditTemp.x"
                        type="number"
                        step="0.001"
                        class="w-16 rounded border border-slate-600 bg-slate-950 px-1 py-0.5 text-xs text-slate-100"
                        @blur="saveLinePointEdit(entity, 'start')"
                        @keydown.enter="saveLinePointEdit(entity, 'start')"
                        @keydown.esc="cancelLinePointEdit"
                      />
                      <input
                        v-model.number="linePointEditTemp.y"
                        type="number"
                        step="0.001"
                        class="w-16 rounded border border-slate-600 bg-slate-950 px-1 py-0.5 text-xs text-slate-100"
                        @blur="saveLinePointEdit(entity, 'start')"
                        @keydown.enter="saveLinePointEdit(entity, 'start')"
                        @keydown.esc="cancelLinePointEdit"
                      />
                    </span>
                  </template>
                  <span
                    v-else
                    class="cursor-pointer rounded px-0.5 hover:bg-slate-700/50"
                    @click="openLinePointEdit(entity, 'start')"
                    >起点：({{ entity.start.x.toFixed(3) }}, {{ entity.start.y.toFixed(3) }})</span
                  >
                  <template
                    v-if="
                      editingLinePoint?.entityId === entity.id && editingLinePoint?.which === 'end'
                    "
                  >
                    <span class="inline-flex items-center gap-1">
                      终点：
                      <input
                        ref="linePointInputRef"
                        v-model.number="linePointEditTemp.x"
                        type="number"
                        step="0.001"
                        class="w-16 rounded border border-slate-600 bg-slate-950 px-1 py-0.5 text-xs text-slate-100"
                        @blur="saveLinePointEdit(entity, 'end')"
                        @keydown.enter="saveLinePointEdit(entity, 'end')"
                        @keydown.esc="cancelLinePointEdit"
                      />
                      <input
                        v-model.number="linePointEditTemp.y"
                        type="number"
                        step="0.001"
                        class="w-16 rounded border border-slate-600 bg-slate-950 px-1 py-0.5 text-xs text-slate-100"
                        @blur="saveLinePointEdit(entity, 'end')"
                        @keydown.enter="saveLinePointEdit(entity, 'end')"
                        @keydown.esc="cancelLinePointEdit"
                      />
                    </span>
                  </template>
                  <span
                    v-else
                    class="cursor-pointer rounded px-0.5 hover:bg-slate-700/50"
                    @click="openLinePointEdit(entity, 'end')"
                    >终点：({{ entity.end.x.toFixed(3) }}, {{ entity.end.y.toFixed(3) }})</span
                  >
                  <span>
                    焊接：{{ entity.welding?.name }}（开口角：{{
                      entity.welding?.openAngle
                    }}，开口量：{{ entity.welding?.openSize }}）
                  </span>
                </div>

                <div
                  v-else-if="entity.type === 'ARC'"
                  class="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5"
                >
                  <span>图层：{{ entity.layerName }}</span>
                  <span>开口方向：{{ entity.openDirection }}</span>
                  <span>基准高：{{ entity.baseHeight }}</span>
                  <span>表面角：{{ entity.surfaceAngle ?? 0 }}</span>
                  <span>挤出高：{{ entity.extrudeHeight }}</span>
                  <!-- 起点 -->
                  <template v-if="isAcEditing(entity.id, 'arcStart')">
                    <span class="inline-flex items-center gap-1">
                      起点：
                      <input
                        ref="acFirstInputRef"
                        v-model.number="acPt.x"
                        type="number"
                        step="0.001"
                        class="w-16 rounded border border-slate-600 bg-slate-950 px-1 py-0.5 text-xs text-slate-100"
                        @blur="saveAcEdit(entity, 'arcStart')"
                        @keydown.enter="saveAcEdit(entity, 'arcStart')"
                        @keydown.esc="cancelAcEdit"
                      />
                      <input
                        v-model.number="acPt.y"
                        type="number"
                        step="0.001"
                        class="w-16 rounded border border-slate-600 bg-slate-950 px-1 py-0.5 text-xs text-slate-100"
                        @blur="saveAcEdit(entity, 'arcStart')"
                        @keydown.enter="saveAcEdit(entity, 'arcStart')"
                        @keydown.esc="cancelAcEdit"
                      />
                    </span>
                  </template>
                  <span
                    v-else
                    class="cursor-pointer rounded px-0.5 hover:bg-slate-700/50"
                    @click="openAcEdit(entity.id, 'arcStart', { pt: arcStartDisplay(entity) })"
                    >起点：({{ arcStartDisplay(entity).x.toFixed(3) }},
                    {{ arcStartDisplay(entity).y.toFixed(3) }})</span
                  >
                  <!-- 终点 -->
                  <template v-if="isAcEditing(entity.id, 'arcEnd')">
                    <span class="inline-flex items-center gap-1">
                      终点：
                      <input
                        ref="acFirstInputRef"
                        v-model.number="acPt.x"
                        type="number"
                        step="0.001"
                        class="w-16 rounded border border-slate-600 bg-slate-950 px-1 py-0.5 text-xs text-slate-100"
                        @blur="saveAcEdit(entity, 'arcEnd')"
                        @keydown.enter="saveAcEdit(entity, 'arcEnd')"
                        @keydown.esc="cancelAcEdit"
                      />
                      <input
                        v-model.number="acPt.y"
                        type="number"
                        step="0.001"
                        class="w-16 rounded border border-slate-600 bg-slate-950 px-1 py-0.5 text-xs text-slate-100"
                        @blur="saveAcEdit(entity, 'arcEnd')"
                        @keydown.enter="saveAcEdit(entity, 'arcEnd')"
                        @keydown.esc="cancelAcEdit"
                      />
                    </span>
                  </template>
                  <span
                    v-else
                    class="cursor-pointer rounded px-0.5 hover:bg-slate-700/50"
                    @click="openAcEdit(entity.id, 'arcEnd', { pt: arcEndDisplay(entity) })"
                    >终点：({{ arcEndDisplay(entity).x.toFixed(3) }},
                    {{ arcEndDisplay(entity).y.toFixed(3) }})</span
                  >
                  <!-- 圆心 -->
                  <template v-if="isAcEditing(entity.id, 'arcCenter')">
                    <span class="inline-flex items-center gap-1">
                      圆心：
                      <input
                        ref="acFirstInputRef"
                        v-model.number="acPt.x"
                        type="number"
                        step="0.001"
                        class="w-16 rounded border border-slate-600 bg-slate-950 px-1 py-0.5 text-xs text-slate-100"
                        @blur="saveAcEdit(entity, 'arcCenter')"
                        @keydown.enter="saveAcEdit(entity, 'arcCenter')"
                        @keydown.esc="cancelAcEdit"
                      />
                      <input
                        v-model.number="acPt.y"
                        type="number"
                        step="0.001"
                        class="w-16 rounded border border-slate-600 bg-slate-950 px-1 py-0.5 text-xs text-slate-100"
                        @blur="saveAcEdit(entity, 'arcCenter')"
                        @keydown.enter="saveAcEdit(entity, 'arcCenter')"
                        @keydown.esc="cancelAcEdit"
                      />
                    </span>
                  </template>
                  <span
                    v-else
                    class="cursor-pointer rounded px-0.5 hover:bg-slate-700/50"
                    @click="openAcEdit(entity.id, 'arcCenter', { pt: entity.center })"
                    >圆心：({{ entity.center.x.toFixed(3) }},
                    {{ entity.center.y.toFixed(3) }})</span
                  >
                  <!-- 半径 -->
                  <template v-if="isAcEditing(entity.id, 'arcRadius')">
                    <span class="inline-flex items-center gap-1">
                      半径：
                      <input
                        ref="acFirstInputRef"
                        v-model.number="acScalar"
                        type="number"
                        step="0.001"
                        min="0"
                        class="w-20 rounded border border-slate-600 bg-slate-950 px-1 py-0.5 text-xs text-slate-100"
                        @blur="saveAcEdit(entity, 'arcRadius')"
                        @keydown.enter="saveAcEdit(entity, 'arcRadius')"
                        @keydown.esc="cancelAcEdit"
                      />
                    </span>
                  </template>
                  <span
                    v-else
                    class="cursor-pointer rounded px-0.5 hover:bg-slate-700/50"
                    @click="openAcEdit(entity.id, 'arcRadius', { scalar: entity.radius })"
                    >半径：{{ entity.radius.toFixed(3) }}</span
                  >
                  <!-- 起始角 -->
                  <template v-if="isAcEditing(entity.id, 'arcStartAngle')">
                    <span class="inline-flex items-center gap-1">
                      起始角：
                      <input
                        ref="acFirstInputRef"
                        v-model.number="acScalar"
                        type="number"
                        step="0.001"
                        class="w-20 rounded border border-slate-600 bg-slate-950 px-1 py-0.5 text-xs text-slate-100"
                        @blur="saveAcEdit(entity, 'arcStartAngle')"
                        @keydown.enter="saveAcEdit(entity, 'arcStartAngle')"
                        @keydown.esc="cancelAcEdit"
                      />
                    </span>
                  </template>
                  <span
                    v-else
                    class="cursor-pointer rounded px-0.5 hover:bg-slate-700/50"
                    @click="openAcEdit(entity.id, 'arcStartAngle', { scalar: entity.startAngle })"
                    >起始角：{{ entity.startAngle.toFixed(3) }}</span
                  >
                  <!-- 终止角 -->
                  <template v-if="isAcEditing(entity.id, 'arcEndAngle')">
                    <span class="inline-flex items-center gap-1">
                      终止角：
                      <input
                        ref="acFirstInputRef"
                        v-model.number="acScalar"
                        type="number"
                        step="0.001"
                        class="w-20 rounded border border-slate-600 bg-slate-950 px-1 py-0.5 text-xs text-slate-100"
                        @blur="saveAcEdit(entity, 'arcEndAngle')"
                        @keydown.enter="saveAcEdit(entity, 'arcEndAngle')"
                        @keydown.esc="cancelAcEdit"
                      />
                    </span>
                  </template>
                  <span
                    v-else
                    class="cursor-pointer rounded px-0.5 hover:bg-slate-700/50"
                    @click="openAcEdit(entity.id, 'arcEndAngle', { scalar: entity.endAngle })"
                    >终止角：{{ entity.endAngle.toFixed(3) }}</span
                  >
                  <span>
                    焊接：{{ entity.welding?.name }}（开口角：{{
                      entity.welding?.openAngle
                    }}，开口量：{{ entity.welding?.openSize }}）
                  </span>
                </div>

                <div
                  v-else-if="entity.type === 'CIRCLE'"
                  class="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5"
                >
                  <span>图层：{{ entity.layerName }}</span>
                  <span>开口方向：{{ entity.openDirection }}</span>
                  <span>基准高：{{ entity.baseHeight }}</span>
                  <span>表面角：{{ entity.surfaceAngle ?? 0 }}</span>
                  <span>挤出高：{{ entity.extrudeHeight }}</span>
                  <template v-if="isAcEditing(entity.id, 'circleCenter')">
                    <span class="inline-flex items-center gap-1">
                      圆心：
                      <input
                        ref="acFirstInputRef"
                        v-model.number="acPt.x"
                        type="number"
                        step="0.001"
                        class="w-16 rounded border border-slate-600 bg-slate-950 px-1 py-0.5 text-xs text-slate-100"
                        @blur="saveAcEdit(entity, 'circleCenter')"
                        @keydown.enter="saveAcEdit(entity, 'circleCenter')"
                        @keydown.esc="cancelAcEdit"
                      />
                      <input
                        v-model.number="acPt.y"
                        type="number"
                        step="0.001"
                        class="w-16 rounded border border-slate-600 bg-slate-950 px-1 py-0.5 text-xs text-slate-100"
                        @blur="saveAcEdit(entity, 'circleCenter')"
                        @keydown.enter="saveAcEdit(entity, 'circleCenter')"
                        @keydown.esc="cancelAcEdit"
                      />
                    </span>
                  </template>
                  <span
                    v-else
                    class="cursor-pointer rounded px-0.5 hover:bg-slate-700/50"
                    @click="openAcEdit(entity.id, 'circleCenter', { pt: entity.center })"
                    >圆心：({{ entity.center.x.toFixed(3) }},
                    {{ entity.center.y.toFixed(3) }})</span
                  >
                  <template v-if="isAcEditing(entity.id, 'circleRadius')">
                    <span class="inline-flex items-center gap-1">
                      半径：
                      <input
                        ref="acFirstInputRef"
                        v-model.number="acScalar"
                        type="number"
                        step="0.001"
                        min="0"
                        class="w-20 rounded border border-slate-600 bg-slate-950 px-1 py-0.5 text-xs text-slate-100"
                        @blur="saveAcEdit(entity, 'circleRadius')"
                        @keydown.enter="saveAcEdit(entity, 'circleRadius')"
                        @keydown.esc="cancelAcEdit"
                      />
                    </span>
                  </template>
                  <span
                    v-else
                    class="cursor-pointer rounded px-0.5 hover:bg-slate-700/50"
                    @click="openAcEdit(entity.id, 'circleRadius', { scalar: entity.radius })"
                    >半径：{{ entity.radius.toFixed(3) }}</span
                  >
                  <span>
                    焊接：{{ entity.welding?.name }}（开口角：{{
                      entity.welding?.openAngle
                    }}，开口量：{{ entity.welding?.openSize }}）
                  </span>
                </div>

                <div
                  v-else-if="entity.type === 'BEZIER'"
                  class="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5"
                >
                  <span>图层：{{ entity.layerName }}</span>
                  <span>开口方向：{{ entity.openDirection }}</span>
                  <span>基准高：{{ entity.baseHeight }}</span>
                  <span>表面角：{{ entity.surfaceAngle ?? 0 }}</span>
                  <span>挤出高：{{ entity.extrudeHeight }}</span>
                  <span>次数：{{ bezierDegree(entity) }} 次</span>
                  <span>点数：{{ entity.points.length }}</span>
                  <template
                    v-for="(point, pointIndex) in entity.points"
                    :key="`${entity.id}-pt-${pointIndex}`"
                  >
                    <template v-if="isAcEditing(entity.id, bezierPointField(pointIndex))">
                      <span class="inline-flex items-center gap-1">
                        {{ bezierPointLabel(entity, pointIndex) }}：
                        <input
                          ref="acFirstInputRef"
                          v-model.number="acPt.x"
                          type="number"
                          step="0.001"
                          class="w-16 rounded border border-slate-600 bg-slate-950 px-1 py-0.5 text-xs text-slate-100"
                          @blur="saveAcEdit(entity, bezierPointField(pointIndex))"
                          @keydown.enter="saveAcEdit(entity, bezierPointField(pointIndex))"
                          @keydown.esc="cancelAcEdit"
                        />
                        <input
                          v-model.number="acPt.y"
                          type="number"
                          step="0.001"
                          class="w-16 rounded border border-slate-600 bg-slate-950 px-1 py-0.5 text-xs text-slate-100"
                          @blur="saveAcEdit(entity, bezierPointField(pointIndex))"
                          @keydown.enter="saveAcEdit(entity, bezierPointField(pointIndex))"
                          @keydown.esc="cancelAcEdit"
                        />
                      </span>
                    </template>
                    <span
                      v-else
                      class="cursor-pointer rounded px-0.5 hover:bg-slate-700/50"
                      @click="
                        openAcEdit(entity.id, bezierPointField(pointIndex), {
                          pt: bezierPointDisplay(entity, pointIndex)
                        })
                      "
                      >{{ bezierPointLabel(entity, pointIndex) }}：({{ point.x.toFixed(3) }},
                      {{ point.y.toFixed(3) }})</span
                    >
                  </template>
                  <span>
                    焊接：{{ entity.welding?.name }}（开口角：{{
                      entity.welding?.openAngle
                    }}，开口量：{{ entity.welding?.openSize }}）
                  </span>

                  <div
                    class="basis-full mt-2 rounded-md border border-slate-700/70 bg-slate-950/70 px-2 py-2 font-mono text-[11px] leading-5 text-slate-200"
                  >
                    <div class="mt-1 whitespace-pre-wrap">
                      B(t) = {{ bezierGeneralFormula(entity) }}
                    </div>
                    <div class="mt-1 whitespace-pre-wrap text-slate-400">
                      其中：{{
                        entity.points
                          .map((_, index) => `P${index}=${bezierPointLabel(entity, index)}`)
                          .join('，')
                      }}
                    </div>
                    <div class="mt-2 whitespace-pre-wrap">
                      x(t) = {{ bezierExpandedCoordinateFormula(entity, 'x') }}
                    </div>
                    <div class="whitespace-pre-wrap">
                      y(t) = {{ bezierExpandedCoordinateFormula(entity, 'y') }}
                    </div>
                  </div>
                </div>

                <div
                  v-else-if="isEllipseLikeIrregularEntity(entity)"
                  class="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5"
                >
                  <span
                    >形状：{{
                      entity.shape === 'marquise'
                        ? '马眼'
                        : entity.shape === 'pear'
                          ? '梨形'
                          : entity.shape === 'heart'
                            ? '心形'
                            : entity.shape === 'square'
                              ? '方形'
                              : entity.shape === 'cushion'
                                ? '垫形'
                                : entity.shape === 'octagon'
                                  ? '祖母绿形'
                                : '椭圆'
                    }}</span
                  >
                  <span>图层：{{ entity.layerName }}</span>
                  <span>开口方向：{{ entity.openDirection }}</span>
                  <span>基准高：{{ entity.baseHeight }}</span>
                  <span>表面角：{{ entity.surfaceAngle ?? 0 }}</span>
                  <span>挤出高：{{ entity.extrudeHeight }}</span>
                  <template v-if="isAcEditing(entity.id, 'ellipseCenter')">
                    <span class="inline-flex items-center gap-1">
                      圆心：
                      <input
                        ref="acFirstInputRef"
                        v-model.number="acPt.x"
                        type="number"
                        step="0.001"
                        class="w-16 rounded border border-slate-600 bg-slate-950 px-1 py-0.5 text-xs text-slate-100"
                        @blur="saveAcEdit(entity, 'ellipseCenter')"
                        @keydown.enter="saveAcEdit(entity, 'ellipseCenter')"
                        @keydown.esc="cancelAcEdit"
                      />
                      <input
                        v-model.number="acPt.y"
                        type="number"
                        step="0.001"
                        class="w-16 rounded border border-slate-600 bg-slate-950 px-1 py-0.5 text-xs text-slate-100"
                        @blur="saveAcEdit(entity, 'ellipseCenter')"
                        @keydown.enter="saveAcEdit(entity, 'ellipseCenter')"
                        @keydown.esc="cancelAcEdit"
                      />
                    </span>
                  </template>
                  <span
                    v-else
                    class="cursor-pointer rounded px-0.5 hover:bg-slate-700/50"
                    @click="openAcEdit(entity.id, 'ellipseCenter', { pt: entity.center })"
                    >圆心：({{ entity.center.x.toFixed(3) }},
                    {{ entity.center.y.toFixed(3) }})</span
                  >
                  <template v-if="isAcEditing(entity.id, 'ellipseRadiusX')">
                    <span class="inline-flex items-center gap-1">
                      长半轴：
                      <input
                        ref="acFirstInputRef"
                        v-model.number="acScalar"
                        type="number"
                        step="0.001"
                        min="0"
                        class="w-20 rounded border border-slate-600 bg-slate-950 px-1 py-0.5 text-xs text-slate-100"
                        @blur="saveAcEdit(entity, 'ellipseRadiusX')"
                        @keydown.enter="saveAcEdit(entity, 'ellipseRadiusX')"
                        @keydown.esc="cancelAcEdit"
                      />
                    </span>
                  </template>
                  <span
                    v-else
                    class="cursor-pointer rounded px-0.5 hover:bg-slate-700/50"
                    @click="openAcEdit(entity.id, 'ellipseRadiusX', { scalar: entity.radiusX })"
                    >长半轴：{{ entity.radiusX.toFixed(3) }}</span
                  >
                  <template v-if="isAcEditing(entity.id, 'ellipseRadiusY')">
                    <span class="inline-flex items-center gap-1">
                      短半轴：
                      <input
                        ref="acFirstInputRef"
                        v-model.number="acScalar"
                        type="number"
                        step="0.001"
                        min="0"
                        class="w-20 rounded border border-slate-600 bg-slate-950 px-1 py-0.5 text-xs text-slate-100"
                        @blur="saveAcEdit(entity, 'ellipseRadiusY')"
                        @keydown.enter="saveAcEdit(entity, 'ellipseRadiusY')"
                        @keydown.esc="cancelAcEdit"
                      />
                    </span>
                  </template>
                  <span
                    v-else
                    class="cursor-pointer rounded px-0.5 hover:bg-slate-700/50"
                    @click="openAcEdit(entity.id, 'ellipseRadiusY', { scalar: entity.radiusY })"
                    >短半轴：{{ entity.radiusY.toFixed(3) }}</span
                  >
                  <template v-if="isAcEditing(entity.id, 'ellipseRotationDeg')">
                    <span class="inline-flex items-center gap-1">
                      长轴角(°)：
                      <input
                        ref="acFirstInputRef"
                        v-model.number="acScalar"
                        type="number"
                        step="0.001"
                        class="w-20 rounded border border-slate-600 bg-slate-950 px-1 py-0.5 text-xs text-slate-100"
                        @blur="saveAcEdit(entity, 'ellipseRotationDeg')"
                        @keydown.enter="saveAcEdit(entity, 'ellipseRotationDeg')"
                        @keydown.esc="cancelAcEdit"
                      />
                    </span>
                  </template>
                  <span
                    v-else
                    class="cursor-pointer rounded px-0.5 hover:bg-slate-700/50"
                    @click="
                      openAcEdit(entity.id, 'ellipseRotationDeg', {scalar: irregularRotationDeg(entity)})
                    "
                    >长轴角(°)：{{ irregularRotationDeg(entity).toFixed(3) }}</span
                  >
                  <span>
                    焊接：{{ entity.welding?.name }}（开口角：{{
                      entity.welding?.openAngle
                    }}，开口量：{{ entity.welding?.openSize }}）
                  </span>
                </div>

                <div v-else class="text-slate-300">暂不支持该类型的详细参数展示。</div>
              </div>
            </template>
          </div>
        </div>

        <!-- 图层管理面板 -->
        <div
          v-else-if="toolButtons.find((b) => b.selected)?.id === 3"
          class="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/60 px-2 py-2 shadow-sm shadow-black/20"
        >
          <div
            class="text-xs font-medium text-slate-200 [writing-mode:vertical-rl] [text-orientation:mixed] tracking-wide"
          >
            图层
          </div>
          <div class="mx-1 h-10 w-px bg-slate-700/70"></div>

          <div class="flex flex-1 flex-wrap items-center gap-2 text-xs text-slate-100">
            <div v-if="layers.length === 0" class="text-slate-400">当前没有图层</div>

            <div
              v-for="layer in layers"
              :key="layer.id"
              class="flex items-center gap-2 rounded-md border border-slate-700/80 bg-slate-900/60 px-2 py-1"
            >
              <input
                class="w-[90px] rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-slate-100"
                :disabled="layer.id === '0'"
                :value="layer.id === '0' ? 'default' : (layerDrafts[layer.id]?.name ?? layer.name)"
                @input="(e) => onLayerNameInput(layer.id, (e.target as HTMLInputElement).value)"
                @blur="saveLayerEdits(layer.id)"
              />

              <label class="flex items-center gap-1">
                <input
                  type="checkbox"
                  class="accent-sky-400"
                  :checked="layerDrafts[layer.id]?.visible ?? layer.visible"
                  @change="
                    (e) => onLayerVisibleToggle(layer.id, (e.target as HTMLInputElement).checked)
                  "
                />
                <span class="text-[10px] text-slate-300 whitespace-nowrap">显示</span>
              </label>

              <span class="text-[10px] text-slate-500 whitespace-nowrap">
                {{ layer.entityCount }}个
              </span>

              <button
                type="button"
                class="rounded border border-slate-700 bg-slate-800/40 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-800 disabled:opacity-50"
                :disabled="selectedEntityIds.length === 0"
                @click="moveSelectedEntitiesToLayer(layer.id)"
              >
                切换到此
              </button>

              <button
                v-if="layer.id !== '0'"
                type="button"
                class="rounded border border-red-700/40 bg-red-700/20 px-2 py-1 text-[11px] text-red-200 hover:bg-red-800 hover:border-red-700 disabled:opacity-50"
                @click="deleteLayer(layer.id)"
              >
                删除
              </button>
            </div>

            <button
              type="button"
              class="rounded border border-slate-700 bg-slate-800/40 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-800"
              @click="addNewLayer"
            >
              新建图层
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- 主体：左右分栏 -->
    <main class="h-[calc(100vh-8rem)] w-full overflow-hidden">
      <div class="flex h-full w-full">
        <!-- 左：2D -->
        <section class="flex h-full min-w-0 flex-1 flex-col border-r border-slate-800">
          <div
            class="flex items-center justify-between border-b border-slate-800 bg-slate-900/40 px-3 py-2"
          >
            <div class="text-xs font-medium text-slate-200">2D</div>
            <div class="flex items-center gap-1 text-xs font-medium text-slate-200">
              <label for="zoom-input" class="whitespace-nowrap">缩放:</label>
              <input
                id="zoom-input"
                v-model.number="viewport.zoom"
                type="number"
                min="1"
                max="50"
                step="0.1"
                class="w-16 rounded border border-slate-700 bg-slate-800/60 px-1.5 py-0.5 text-center text-xs text-slate-200 outline-none focus:border-sky-500/70"
              />
            </div>
            <div class="flex items-center gap-2">
              <button
                v-for="toolButton in canvas2dTools.function"
                :key="toolButton.id"
                type="button"
                class="rounded-lg border border-slate-700 bg-slate-800/50 px-2 py-1 text-[11px] hover:bg-slate-800"
                :class="
                  canvas2dActiveToolId === toolButton.id
                    ? 'border-white bg-slate-800 text-white'
                    : 'border-transparent text-slate-200 hover:border-slate-600 hover:bg-slate-800/40 hover:text-white'
                "
                @click="selectCanvas2DTool(toolButton.id)"
                @keydown.enter.prevent
              >
                {{ toolButton.name }}
              </button>
            </div>
          </div>

          <div class="relative flex-1 bg-slate-950">
            <QomoCanvas class="absolute inset-0 h-full w-full" />
          </div>
        </section>

        <!-- 右：3D -->
        <section class="flex h-full min-w-0 flex-1 flex-col">
          <div
            class="flex items-center justify-between border-b border-slate-800 bg-slate-900/40 px-3 py-2"
          >
            <div class="text-xs font-medium text-slate-200">3D 预览</div>
            <div class="flex items-center gap-2">
              <button
                v-for="toolButton in threePreviewTools.function_change"
                :key="toolButton.id"
                type="button"
                class="rounded-lg border border-slate-700 bg-slate-800/50 px-2 py-1 text-[11px] hover:bg-slate-800"
                :class="
                  threeDActiveToolId === toolButton.id
                    ? 'border-white bg-slate-800 text-white'
                    : 'border-transparent text-slate-200 hover:border-slate-600 hover:bg-slate-800/40 hover:text-white'
                "
                @click="select3DTools(toolButton.id)"
                @keydown.enter.prevent
              >
                {{ toolButton.name }}
              </button>
            </div>
          </div>
          <!-- <div class="flex items-center justify-between border-b border-slate-800 bg-slate-900/40 px-3 py-2">
            <div class="text-xs font-medium text-slate-200">3D 预览</div>
            <div class="flex items-center gap-2">
              <button
                class="rounded border border-slate-700 bg-slate-800/50 px-2 py-1 text-[11px] hover:bg-slate-800"
                type="button"
                @click="handle3DFitView"
              >
                适应视图
              </button>
              <button
                class="rounded border border-slate-700 bg-slate-800/50 px-2 py-1 text-[11px] hover:bg-slate-800"
                type="button"
                @click="handle3DToggleGrid"
              >
                显示网格
              </button>
            </div>
          </div> -->

          <div class="relative flex-1 bg-slate-950">
            <Qomo3DPreview class="absolute inset-0 h-full w-full" />
          </div>
        </section>
      </div>
    </main>

    <!-- 文件菜单（Teleport 到 body，避免被 overflow-hidden 裁剪） -->
    <Teleport to="body">
      <div
        v-if="fileMenuOpen"
        ref="fileMenuRef"
        class="fixed z-100 w-20 rounded-lg border border-slate-700 bg-slate-900/95 p-1 shadow-lg shadow-black/40"
        :style="{ left: `${fileMenuPos.left}px`, top: `${fileMenuPos.top}px` }"
        @click.stop
      >
        <button
          @click="handleCreateProject(projectName)"
          type="button"
          class="w-full rounded-md px-3 py-2 text-left text-xs text-slate-100 hover:bg-slate-800"
        >
          新建
        </button>
        <button
          type="button"
          class="w-full rounded-md px-3 py-2 text-left text-xs text-slate-100 hover:bg-slate-800"
          @click="handleImportClick"
        >
          导入…
        </button>
        <button
          type="button"
          class="w-full rounded-md px-3 py-2 text-left text-xs text-slate-100 hover:bg-slate-800"
          @click="handleCanvasSave(projectName)"
        >
          保存
        </button>
      </div>
    </Teleport>

    <!-- 绘画工具创建方法选择 -->
    <Teleport to="body">
      <div
        v-if="drawingShapeToolsMenuOpen"
        ref="drawingShapeToolsMenuRef"
        class="fixed z-100 w-32 max-h-64 overflow-auto rounded-lg border border-slate-700 bg-slate-900/95 p-1 shadow-lg shadow-black/40"
        :style="{
          left: `${drawingShapeToolsMenuPos.left}px`,
          top: `${drawingShapeToolsMenuPos.top}px`
        }"
        @click.stop
        @mouseenter="onDrawingShapeToolsMenuMouseEnter"
        @mouseleave="onDrawingShapeToolsMenuMouseLeave"
      >
        <button
          v-for="shapeTool in drawingShapeToolsMenuItems"
          :key="shapeTool"
          type="button"
          class="w-full rounded-md px-3 py-2 text-left text-xs text-slate-100 hover:bg-slate-800"
          @click.stop="onSelectDrawingShapeTool(shapeTool)"
        >
          {{ drawingShapeToolLabel(shapeTool) }}
        </button>
      </div>
    </Teleport>

    <!-- 编辑实体参数弹窗 -->
    <Teleport to="body">
      <div
        v-if="editModalOpen"
        class="fixed inset-0 z-200 flex items-center justify-center bg-black/50"
        @click="closeEditParams"
      >
        <div
          class="w-[440px] max-w-[92vw] rounded-lg border border-slate-700 bg-slate-900/95 p-4 shadow-lg shadow-black/40"
          @click.stop
        >
          <div class="flex items-center justify-between mb-3">
            <div class="text-sm font-semibold text-slate-100">编辑参数</div>
            <button
              type="button"
              class="rounded-md border border-slate-700 bg-slate-800/40 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800"
              @click="closeEditParams"
            >
              关闭
            </button>
          </div>

          <div v-if="editingEntity" class="space-y-3 text-xs">
            <div class="text-slate-300">
              ID:<span class="text-sky-300">{{ editingEntity.id }}</span> ({{
                editingEntity.type
              }})
            </div>

            <div class="grid grid-cols-2 gap-2">
              <label class="flex flex-col gap-1 text-slate-300">
                开口方向
                <select
                  v-model="editForm.openDirection"
                  class="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
                >
                  <option value="LEFT">LEFT</option>
                  <option value="RIGHT">RIGHT</option>
                </select>
              </label>

              <label class="flex flex-col gap-1 text-slate-300">
                焊接名称
                <input
                  v-model="editForm.weldingName"
                  class="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
                  type="text"
                />
              </label>

              <label class="flex flex-col gap-1 text-slate-300">
                基准高
                <input
                  v-model.number="editForm.baseHeight"
                  class="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
                  type="number"
                  step="0.001"
                />
              </label>

              <label class="flex flex-col gap-1 text-slate-300">
                挤出高
                <input
                  v-model.number="editForm.extrudeHeight"
                  class="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
                  type="number"
                  step="0.001"
                />
              </label>

              <label class="flex flex-col gap-1 text-slate-300">
                开口角
                <input
                  v-model.number="editForm.openAngle"
                  class="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
                  type="number"
                  step="0.001"
                />
              </label>

              <label class="flex flex-col gap-1 text-slate-300">
                表面角（surfaceAngle）
                <input
                  v-model.number="editForm.surfaceAngle"
                  class="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
                  type="number"
                  step="0.001"
                />
              </label>

              <label class="flex flex-col gap-1 text-slate-300">
                开口量
                <input
                  v-model.number="editForm.openSize"
                  class="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
                  type="number"
                  step="0.001"
                />
              </label>
            </div>
          </div>

          <div class="mt-4 flex justify-end gap-2">
            <button
              type="button"
              class="rounded-md border border-slate-700 bg-slate-800/40 px-3 py-1 text-xs text-slate-200 hover:bg-slate-800"
              @click="closeEditParams"
            >
              取消
            </button>
            <button
              type="button"
              class="rounded-md bg-blue-700 px-3 py-1 text-xs text-white hover:bg-blue-800"
              @click="saveEditParams"
            >
              保存
            </button>
          </div>
        </div>
      </div>
    </Teleport>

  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useNotification } from '@/shared/composables/useNotification'
import QomoCanvas from './panels/QomoCanvas.vue'
import Qomo3DPreview from './panels/Qomo3DPreview.vue'
import { dispatchQomoTo5PAction } from './cad/QomoTo5P'
import { dispatchQomoToCanvasAction, DrawingShapeTools } from './cad/QomoToCanvas'
import {
  EntityType,
  OpenDirectionType,
  type QomoArcSurfacesEntity,
  type QomoBezierSurfacesEntity,
  type QomoEntityWithSurface
} from './qomo5pTypes'
import { useQomo5PStore } from './useQomo5PStore'
import {
  invertShowImageOffsetX,
  invertShowImageOffsetY,
  resetShowImageOffset
} from './showImageOffset'
import { storeToRefs } from 'pinia'
const store = useQomo5PStore()
const { viewport, layers, entities, selectedEntityIds } = storeToRefs(store)
const { success, error } = useNotification()
const isEllipseLikeIrregularEntity = (
  entity: QomoEntityWithSurface
): entity is Extract<QomoEntityWithSurface, { type: 'IRREGULAR' }> =>
  entity.type === 'IRREGULAR' &&
  (entity.shape === 'oval' ||
    entity.shape === 'square' ||
    entity.shape === 'cushion' ||
    entity.shape === 'octagon' ||
    entity.shape === 'marquise' ||
    entity.shape === 'pear' ||
    entity.shape === 'heart')
/** 模板里 v-if 收窄不稳定，辅助函数入参用联合类型再自行收窄 */
const asBezierEntity = (entity: QomoEntityWithSurface): QomoBezierSurfacesEntity | null =>
  entity.type === 'BEZIER' ? entity : null
const bezierPointDisplay = (entity: QomoEntityWithSurface, index: number) =>
  asBezierEntity(entity)?.points[index] ?? { x: 0, y: 0 }
const bezierDegree = (entity: QomoEntityWithSurface) =>
  Math.max((asBezierEntity(entity)?.points.length ?? 1) - 1, 0)
const bezierPointLabel = (entity: QomoEntityWithSurface, index: number) => {
  const bezier = asBezierEntity(entity)
  if (!bezier) return `点${index}`
  if (index === 0) return '起点'
  if (index === bezier.points.length - 1) return '终点'
  return `控制点${index}`
}
const irregularRotationDeg = (entity: QomoEntityWithSurface): number =>
  isEllipseLikeIrregularEntity(entity) ? entity.rotationDeg : 0
const formatFormulaNumber = (value: number) => {
  const rounded = Number(value.toFixed(3))
  return String(rounded)
}
const binomial = (n: number, k: number) => {
  if (k < 0 || k > n) return 0
  let result = 1
  for (let index = 1; index <= k; index += 1) {
    result = (result * (n - index + 1)) / index
  }
  return Math.round(result)
}
const bezierBasisTermLabel = (degree: number, index: number) => {
  const parts: string[] = []
  const coefficient = binomial(degree, index)
  if (coefficient !== 1) parts.push(String(coefficient))
  const mtPower = degree - index
  const tPower = index
  if (mtPower > 0) parts.push(mtPower === 1 ? '(1-t)' : `(1-t)^${mtPower}`)
  if (tPower > 0) parts.push(tPower === 1 ? 't' : `t^${tPower}`)
  return parts.join('')
}
const bezierGeneralFormula = (entity: QomoEntityWithSurface) => {
  const bezier = asBezierEntity(entity)
  if (!bezier) return ''
  return bezier.points
    .map((_, index) => `${bezierBasisTermLabel(bezierDegree(bezier), index)} P${index}`)
    .join(' + ')
}
const bezierExpandedCoordinateFormula = (entity: QomoEntityWithSurface, axis: 'x' | 'y') => {
  const bezier = asBezierEntity(entity)
  if (!bezier) return ''
  return bezier.points
    .map(
      (point, index) =>
        `${bezierBasisTermLabel(bezierDegree(bezier), index)} * ${formatFormulaNumber(point[axis])}`
    )
    .join(' + ')
}
// 文件菜单的按钮
const fileMenuOpen = ref(false)
const fileBtnRef = ref<HTMLElement | null>(null)
const fileMenuRef = ref<HTMLElement | null>(null)
const fileMenuPos = ref({ left: 0, top: 0 })
const importFileInputRef = ref<HTMLInputElement | null>(null)
// 绘图多功能选择
const drawingShapeToolsMenuOpen = ref(false)
const drawingShapeToolsBtnRef = ref<HTMLElement | null>(null)
const drawingShapeToolsMenuRef = ref<HTMLElement | null>(null)
const drawingShapeToolsMenuPos = ref({ left: 0, top: 0 })

const drawingShapeToolsMenuToolId = ref<string | null>(null)
const drawingShapeToolsMenuHovering = ref(false)
const drawingShapeToolsCloseTimer = ref<ReturnType<typeof setTimeout> | null>(null)

const closeDrawingShapeToolsMenu = () => {
  drawingShapeToolsMenuOpen.value = false
  drawingShapeToolsMenuToolId.value = null
  drawingShapeToolsMenuHovering.value = false
  drawingShapeToolsBtnRef.value = null

  if (drawingShapeToolsCloseTimer.value) {
    clearTimeout(drawingShapeToolsCloseTimer.value)
    drawingShapeToolsCloseTimer.value = null
  }
}

const scheduleCloseDrawingShapeToolsMenu = (delayMs = 180) => {
  if (drawingShapeToolsCloseTimer.value) clearTimeout(drawingShapeToolsCloseTimer.value)
  drawingShapeToolsCloseTimer.value = setTimeout(() => {
    if (drawingShapeToolsMenuHovering.value) return
    closeDrawingShapeToolsMenu()
  }, delayMs)
}

// 绘图多功能选择菜单打开
const openDrawingShapeToolsMenuForTool = (
  tool: { id: string; DrawingShapeTools?: DrawingShapeTools[] },
  btnEl: HTMLElement
) => {
  const opts = tool.DrawingShapeTools ?? []
  if (opts.length < 2) {
    closeDrawingShapeToolsMenu()
    return
  }
  if (drawingShapeToolsCloseTimer.value) {
    clearTimeout(drawingShapeToolsCloseTimer.value)
    drawingShapeToolsCloseTimer.value = null
  }
  drawingShapeToolsMenuToolId.value = tool.id
  drawingShapeToolsMenuOpen.value = true
  drawingShapeToolsMenuHovering.value = false
  drawingShapeToolsBtnRef.value = btnEl

  const r = btnEl.getBoundingClientRect()
  const menuWidth = 260 // 粗略估计，用于防越界
  const desiredLeft = Math.round(r.left)
  const clampedLeft = Math.min(Math.max(8, desiredLeft), window.innerWidth - menuWidth - 8)

  drawingShapeToolsMenuPos.value = { left: clampedLeft, top: Math.round(r.bottom + 6) }
}

const onCanvas2DDrawingToolMouseEnter = (
  tool: { id: string; DrawingShapeTools?: DrawingShapeTools[] },
  e: MouseEvent
) => {
  const btnEl = e.currentTarget as HTMLElement | null
  if (!btnEl) return
  openDrawingShapeToolsMenuForTool(tool, btnEl)
}

const onCanvas2DDrawingToolMouseLeave = () => {
  scheduleCloseDrawingShapeToolsMenu()
}
// 进入绘图的事件=======start=====
const onDrawingShapeToolsMenuMouseEnter = () => {
  drawingShapeToolsMenuHovering.value = true
  if (drawingShapeToolsCloseTimer.value) {
    clearTimeout(drawingShapeToolsCloseTimer.value)
    drawingShapeToolsCloseTimer.value = null
  }
}

const onDrawingShapeToolsMenuMouseLeave = () => {
  drawingShapeToolsMenuHovering.value = false
  scheduleCloseDrawingShapeToolsMenu()
}
// 进入绘图的事件=======end=====

const toggleFileMenu = () => {
  fileMenuOpen.value = !fileMenuOpen.value
  if (fileMenuOpen.value) {
    void nextTick(() => updateFileMenuPos())
  }
}
const closeFileMenu = () => {
  fileMenuOpen.value = false
}

const updateFileMenuPos = () => {
  const btn = fileBtnRef.value
  if (!btn) return
  const r = btn.getBoundingClientRect()
  fileMenuPos.value = {
    left: Math.round(r.left),
    top: Math.round(r.bottom + 6)
  }
}

const handleDocMouseDown = (e: MouseEvent) => {
  if (!fileMenuOpen.value && !drawingShapeToolsMenuOpen.value) return
  const t = e.target as Node | null
  if (!t) return

  if (fileMenuOpen.value) {
    if (fileBtnRef.value?.contains(t)) return
    if (fileMenuRef.value?.contains(t)) return
    closeFileMenu()
    return
  }

  if (drawingShapeToolsMenuOpen.value) {
    if (drawingShapeToolsBtnRef.value?.contains(t)) return
    if (drawingShapeToolsMenuRef.value?.contains(t)) return
    closeDrawingShapeToolsMenu()
  }
}

// 顶部工具按钮
const toolButtons = ref([
  { id: 1, name: '绘图工具', selected: true },
  { id: 2, name: '参数信息', selected: false },
  { id: 3, name: '图层管理', selected: false }
])

const selectToolButton = (id: number) => {
  toolButtons.value = toolButtons.value.map((b) => ({
    ...b,
    selected: b.id === id
  }))
}
/** 3D 预览：功能工具共用一套 id，全局仅一项选中（3dActiveToolId） */
type ThreePreviewToolId =
  | '3d-fit-view'
  | '3d-toggle-grid'
  | '3d-toggle-axes'
  | '3d-toggle-projection-z0'

interface ThreePreviewFunctionTool {
  id: ThreePreviewToolId
  name: string
}

const threeDActiveToolId = ref<ThreePreviewToolId>('3d-fit-view')

const threePreviewTools = ref<{ function_change: ThreePreviewFunctionTool[] }>({
  function_change: [
    { id: '3d-fit-view', name: '适应视图' },
    { id: '3d-toggle-grid', name: '显示网格' },
    { id: '3d-toggle-axes', name: '显示坐标轴' },
    { id: '3d-toggle-projection-z0', name: '展示投影' }
  ]
})

/** 2D 画布：功能工具 + 绘图工具共用一套 id，全局仅一项选中（canvas2dActiveToolId） */
type Canvas2DToolId =
  | 'fn-select'
  | 'fn-pan'
  | 'fn-delete'
  | 'draw-line'
  | 'draw-polyline'
  | 'draw-circle'
  | 'draw-arc'
  | 'draw-bezier'
  | 'draw-irregular'

type DrawingTool2DShape =
  | { kind: 'path'; d: string }
  | { kind: 'circle'; cx: number; cy: number; r: number; fill: boolean }
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number; fill: boolean }

interface DrawingTool2D {
  id: Canvas2DToolId
  name: string
  entityType?: EntityType
  svgStrokeLinecap?: 'round'
  shapes: DrawingTool2DShape[]
  DrawingShapeTools?: DrawingShapeTools[]
}

interface Canvas2DFunctionTool {
  id: 'fn-select' | 'fn-pan' | 'fn-delete'
  name: string
}
interface Canvas2DFunctionComplexTool {
  id: string
  name: string
}


const canvas2dActiveToolId = ref<Canvas2DToolId>('fn-select')

const canvas2dTools = ref<{
  function: Canvas2DFunctionTool[]
  drawing: DrawingTool2D[]
  complexfunction: Canvas2DFunctionComplexTool[]
}>({
  function: [
    { id: 'fn-select', name: '选择' },
    { id: 'fn-pan', name: '平移' },
    { id: 'fn-delete', name: '删除' }
  ],
  complexfunction: [
    { id: 'complex_offset', name: '偏移图形' },
    { id: 'complex_boolean', name: '布尔运算' }
  ],
  drawing: [
    {
      id: 'draw-line',
      name: '直线',
      entityType: 'LINE',
      shapes: [
        { kind: 'path', d: 'M5 19 L19 5' },
        { kind: 'circle', cx: 5, cy: 19, r: 1.5, fill: true },
        { kind: 'circle', cx: 19, cy: 5, r: 1.5, fill: true }
      ],
      DrawingShapeTools: ['only_line']
    },
    {
      id: 'draw-polyline',
      name: '多段线',
      entityType: 'LINE',
      shapes: [
        { kind: 'path', d: 'M5 18 L9 14 L13 16 L19 8' },
        { kind: 'circle', cx: 5, cy: 18, r: 1.2, fill: true },
        { kind: 'circle', cx: 9, cy: 14, r: 1.2, fill: true },
        { kind: 'circle', cx: 13, cy: 16, r: 1.2, fill: true },
        { kind: 'circle', cx: 19, cy: 8, r: 1.2, fill: true }
      ],
      DrawingShapeTools: ['more_line']
    },
    {
      id: 'draw-circle',
      name: '圆',
      entityType: 'CIRCLE',
      shapes: [
        { kind: 'circle', cx: 12, cy: 12, r: 7, fill: false },
        { kind: 'circle', cx: 12, cy: 12, r: 1.5, fill: true }
      ],
      DrawingShapeTools: ['two_points', 'three_points_circle', 'center_radius', 'center_diameter']
    },
    {
      id: 'draw-arc',
      name: '圆弧',
      entityType: 'ARC',
      svgStrokeLinecap: 'round',
      shapes: [
        { kind: 'path', d: 'M6 16 A7 7 0 0 1 18 8' },
        { kind: 'circle', cx: 6, cy: 16, r: 1.2, fill: true },
        { kind: 'circle', cx: 18, cy: 8, r: 1.2, fill: true }
      ],
      DrawingShapeTools: ['three_points_arc','start_center_end','start_center_angle','start_center_length','center_start_end','center_start_angle','center_start_length']
    },
    {
      id: 'draw-bezier',
      name: '贝塞尔',
      entityType: 'BEZIER',
      svgStrokeLinecap: 'round',
      shapes: [
        { kind: 'path', d: 'M4 18 C8 5, 16 19, 20 7' },
        { kind: 'circle', cx: 4, cy: 18, r: 1.2, fill: true },
        { kind: 'circle', cx: 8, cy: 5, r: 1.2, fill: true },
        { kind: 'circle', cx: 16, cy: 19, r: 1.2, fill: true },
        { kind: 'circle', cx: 20, cy: 7, r: 1.2, fill: true }
      ],
      DrawingShapeTools: ['cubic_bezier']
    },
    {
      id: 'draw-irregular',
      name: '多变形',
      entityType: 'IRREGULAR',
      svgStrokeLinecap: 'round',
      shapes: [
        { kind: 'path', d: 'M12 8 L18 14 L12 20 L6 14 Z' },
        { kind: 'circle', cx: 12, cy: 8, r: 1.2, fill: true },
        { kind: 'circle', cx: 18, cy: 14, r: 1.2, fill: true },
        { kind: 'circle', cx: 12, cy: 20, r: 1.2, fill: true },
        { kind: 'circle', cx: 6, cy: 14, r: 1.2, fill: true }
      ],
      DrawingShapeTools: ['oval', 'heart', 'pear', 'square', 'marquise', 'cushion', 'octagon']
    }
  ]
})

const drawingShapeToolsMenuItems = computed(() => {
  if (!drawingShapeToolsMenuToolId.value) return []
  const tool = canvas2dTools.value.drawing.find((t) => t.id === drawingShapeToolsMenuToolId.value)
  return tool?.DrawingShapeTools ?? []
})

// 添加对应的名字
const drawingShapeToolLabel = (tool: DrawingShapeTools) => {
  const map: Partial<Record<DrawingShapeTools, string>> = {
    only_line: '单线',
    more_line: '多线',
    three_points_arc: '三点圆弧',
    start_center_end: '起点-圆心-终点',
    start_center_angle: '起点-圆心-角度',
    start_center_length: '起点-圆心-长度',
    center_start_end: '圆心-起点-终点',
    center_start_angle: '圆心-起点-角度',
    center_start_length: '圆心-起点-长度',
    two_points: '两点画圆',
    three_points_circle: '三点画圆',
    center_radius: '圆心-半径',
    center_diameter: '圆心-直径',
    cubic_bezier: '三次贝塞尔',
    oval: '椭圆(中心-长-宽)',
    marquise: '马眼(中心-长-宽)',
    heart: '心形(中心-长-宽)',
    pear: '梨形(中心-长-宽)',
    square: '方形(中心-边长)',
    cushion: '垫形(中心-长-宽)',
    octagon: '祖母(中心-长-宽)'
  }
  return map[tool] ?? tool
}

const projectName = ref<string>('untitled')

// 按钮用来dispatchQomoTo5PAction(action)：由 Create5P.vue 派发按钮动作中间传递给QomoTo5p.ts给 Qomo3DPreview.vue
const handle3DFitView = () => {
  dispatchQomoTo5PAction({ type: 'FIT_VIEW' })
}
const handle3DToggleGrid = () => {
  dispatchQomoTo5PAction({ type: 'TOGGLE_GRID' })
}
const handle3DToggleAxes = () => {
  dispatchQomoTo5PAction({ type: 'TOGGLE_AXES' })
}
const handle3DToggleProjectionZ0 = () => {
  dispatchQomoTo5PAction({ type: 'TOGGLE_PROJECTION_Z0' })
}
// 按钮用来dispatchQomoToCanvasAction(action)：由 Create5P.vue 派发按钮动作中间传递给QomoToCanvas.ts给 QomoCanvas.vue
const handleCanvasDrawing = (entityType: EntityType, drawingShapeTool?: DrawingShapeTools) => {
  dispatchQomoToCanvasAction({
    type: 'DRAWING',
    entityType: entityType,
    drawingShapeTool: drawingShapeTool
  })
}
const handleCreateProject = (projectName: string) => {
  dispatchQomoToCanvasAction({ type: 'CREATE_PROJECT', projectName: projectName })
}
const handleCanvasMove = () => {
  dispatchQomoToCanvasAction({ type: 'MOVE' })
}
const handleCanvasSelect = () => {
  dispatchQomoToCanvasAction({ type: 'SELECT' })
}
const handleCanvasDelete = () => {
  dispatchQomoToCanvasAction({ type: 'DELETE_SELECTED' })
}

const onSelectDrawingShapeTool = (shapeTool: DrawingShapeTools) => {
  if (!drawingShapeToolsMenuToolId.value) return
  const drawTool = canvas2dTools.value.drawing.find(
    (t) => t.id === drawingShapeToolsMenuToolId.value
  )
  if (!drawTool?.entityType) return

  // 激活主绘图工具，然后携带具体绘制方式继续绘制
  canvas2dActiveToolId.value = drawTool.id
  handleCanvasDrawing(drawTool.entityType, shapeTool)
  closeDrawingShapeToolsMenu()
}

const select3DTools = (id: ThreePreviewToolId) => {
  threeDActiveToolId.value = id
  if (id === '3d-fit-view') handle3DFitView()
  if (id === '3d-toggle-grid') handle3DToggleGrid()
  if (id === '3d-toggle-axes') handle3DToggleAxes()
  if (id === '3d-toggle-projection-z0') handle3DToggleProjectionZ0()
}

const selectCanvas2DTool = (id: Canvas2DToolId) => {
  closeDrawingShapeToolsMenu()
  canvas2dActiveToolId.value = id
  if (id === 'fn-select') handleCanvasSelect()
  if (id === 'fn-pan') handleCanvasMove()
  if (id === 'fn-delete') handleCanvasDelete()
  const draw = canvas2dTools.value.drawing.find((t) => t.id === id)
  if (draw?.entityType != null) {
    // 对于只有单一绘制方式的工具（例如“多段线”只有 more_line），需要在这里直接带上 shapeTool
    // 否则菜单不会打开，会导致 QomoCanvas 只能拿到默认 only_line。
    const singleShapeTool =
      draw.DrawingShapeTools?.length === 1 ? draw.DrawingShapeTools[0] : undefined
    const defaultShapeTool = draw.id === 'draw-irregular' ? 'oval' : singleShapeTool
    handleCanvasDrawing(draw.entityType, defaultShapeTool)
  }
}
const handleCanvasUndo = () => {
  dispatchQomoToCanvasAction({ type: 'UNDO' })
}
const handleCanvasRedo = () => {
  dispatchQomoToCanvasAction({ type: 'REDO' })
}
const handleCanvasSave = (projectName: string) => {
  dispatchQomoToCanvasAction({ type: 'SAVE', projectName: projectName })
}

const handleImportClick = () => {
  closeFileMenu()
  importFileInputRef.value?.click()
}

const handleImportFileChange = async (event: Event) => {
  const input = event.target as HTMLInputElement | null
  const file = input?.files?.[0]
  if (!file) return

  const normalizedName = file.name.trim()
  const lowerName = normalizedName.toLowerCase()

  try {
    if (lowerName.endsWith('.ljs')) {
      const text = await file.text()
      store.importProjectFromLjs(text, normalizedName)
      projectName.value = normalizedName.replace(/\.ljs$/i, '')
      success('导入成功', `已导入 ${normalizedName}`)
      return
    }

    if (lowerName.endsWith('.dxf')) {
      const text = await file.text()
      store.importProjectFromDxf(text, normalizedName)
      projectName.value = normalizedName.replace(/\.dxf$/i, '')
      success('导入成功', `已导入 ${normalizedName}`)
      return
    }

    error('不支持的文件类型', '请导入 .ljs 或 .dxf 文件')
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知错误'
    error('导入失败', message)
  } finally {
    if (input) input.value = ''
  }
}
//==========================================================================================================

const selectedEntities = computed(() =>
  entities.value.filter((entity) => selectedEntityIds.value.includes(entity.id))
)

const selectedTopToolId = computed(() => toolButtons.value.find((b) => b.selected)?.id ?? 0)
const layerDrafts = ref<Record<string, { name: string; visible: boolean }>>({})

const syncLayerDrafts = () => {
  layerDrafts.value = Object.fromEntries(
    layers.value.map((l) => [l.id, { name: l.name, visible: l.visible }])
  )
}

watch(
  () => selectedTopToolId.value,
  (id) => {
    if (id === 3) syncLayerDrafts()
  },
  { immediate: true }
)

const saveLayerEdits = (layerId: string) => {
  const draft = layerDrafts.value[layerId]
  if (!draft) return
  store.updateLayer(layerId, { name: draft.name, visible: draft.visible })
}

const moveSelectedEntitiesToLayer = (targetLayerId: string) => {
  store.moveEntitiesToLayer(selectedEntityIds.value, targetLayerId)
}

const addNewLayer = () => {
  const newLayerId = store.addLayer()
  syncLayerDrafts()
  if (selectedEntityIds.value.length > 0) {
    store.moveEntitiesToLayer(selectedEntityIds.value, newLayerId)
  }
}

const deleteLayer = (layerId: string) => {
  if (layerId === '0') return
  store.deleteLayer(layerId)
  syncLayerDrafts()
}

const ensureLayerDraft = (layerId: string) => {
  if (layerDrafts.value[layerId]) return
  const layer = layers.value.find((l) => l.id === layerId)
  if (!layer) return
  layerDrafts.value[layerId] = { name: layer.name, visible: layer.visible }
}

const onLayerNameInput = (layerId: string, nextName: string) => {
  ensureLayerDraft(layerId)
  layerDrafts.value[layerId].name = nextName
}

const onLayerVisibleToggle = (layerId: string, visible: boolean) => {
  ensureLayerDraft(layerId)
  layerDrafts.value[layerId].visible = visible
  saveLayerEdits(layerId)
}

// =================================编辑参数界面的参数及方法START========================================
// =================================编辑参数界面的参数及方法START========================================
// =================================编辑参数界面的参数及方法START========================================
// =================================编辑参数界面的参数及方法START========================================
const editModalOpen = ref(false)
const editingEntityId = ref<string | null>(null)
const editingEntity = computed(() => {
  if (!editingEntityId.value) return null
  return entities.value.find((e) => e.id === editingEntityId.value) || null
})

/** 点击起点/终点 span 时进入编辑态 */
const editingLinePoint = ref<{ entityId: string; which: 'start' | 'end' } | null>(null)
const linePointEditTemp = ref({ x: 0, y: 0 })
const linePointInputRef = ref<HTMLInputElement | null>(null)

const openLinePointEdit = (
  entity: { id: string; start: { x: number; y: number }; end: { x: number; y: number } },
  which: 'start' | 'end'
) => {
  const pt = which === 'start' ? entity.start : entity.end
  linePointEditTemp.value = { x: pt.x, y: pt.y }
  editingLinePoint.value = { entityId: entity.id, which }
  nextTick(() => linePointInputRef.value?.focus())
}

const saveLinePointEdit = (entity: { id: string }, which: 'start' | 'end') => {
  const x = Number(linePointEditTemp.value.x)
  const y = Number(linePointEditTemp.value.y)
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    cancelLinePointEdit()
    return
  }
  store.updateEntityParams(entity.id, which === 'start' ? { start: { x, y } } : { end: { x, y } })
  editingLinePoint.value = null
}

const cancelLinePointEdit = () => {
  editingLinePoint.value = null
}

/** 圆弧：无 startPoint/endPoint 时用角度推算端点显示与编辑初值 */
const arcPolarPoint = (e: QomoArcSurfacesEntity, angleDeg: number) => {
  const rad = (angleDeg * Math.PI) / 180
  return { x: e.center.x + e.radius * Math.cos(rad), y: e.center.y + e.radius * Math.sin(rad) }
}
const arcStartDisplay = (e: QomoArcSurfacesEntity) => e.startPoint ?? arcPolarPoint(e, e.startAngle)
const arcEndDisplay = (e: QomoArcSurfacesEntity) => e.endPoint ?? arcPolarPoint(e, e.endAngle)

type AcEditField =
  | 'arcStart'
  | 'arcEnd'
  | 'arcCenter'
  | 'arcRadius'
  | 'arcStartAngle'
  | 'arcEndAngle'
  | 'circleCenter'
  | 'circleRadius'
  | `bezierPoint-${number}`
  | 'ellipseCenter'
  | 'ellipseRadiusX'
  | 'ellipseRadiusY'
  | 'ellipseRotationDeg'

const acEdit = ref<{ entityId: string; field: AcEditField } | null>(null)
const acPt = ref({ x: 0, y: 0 })
const acScalar = ref(0)
const acFirstInputRef = ref<HTMLInputElement | null>(null)

const isAcEditing = (entityId: string, field: AcEditField) =>
  acEdit.value?.entityId === entityId && acEdit.value?.field === field

const bezierPointField = (index: number) => `bezierPoint-${index}` as AcEditField
const bezierPointIndexFromField = (field: AcEditField) => {
  if (!field.startsWith('bezierPoint-')) return null
  const index = Number(field.slice('bezierPoint-'.length))
  return Number.isInteger(index) ? index : null
}

const openAcEdit = (entityId: string,field: AcEditField,opts?: { pt?: { x: number; y: number }; scalar?: number }) => {
  if (opts?.pt) acPt.value = { x: opts.pt.x, y: opts.pt.y }
  if (typeof opts?.scalar === 'number') acScalar.value = opts.scalar
  acEdit.value = { entityId, field }
  nextTick(() => acFirstInputRef.value?.focus())
}

const saveAcEdit = (entity: { id: string; type: string }, field: AcEditField) => {
  const id = entity.id
  const bezierPointIndex = bezierPointIndexFromField(field)
  if (field === 'arcStart' ||field === 'arcEnd' ||field === 'arcCenter' ||field === 'circleCenter' ||bezierPointIndex !== null ||field === 'ellipseCenter') {
    const x = Number(acPt.value.x)
    const y = Number(acPt.value.y)
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      cancelAcEdit()
      return
    }
    if (field === 'arcStart') store.updateEntityParams(id, { arcStartPoint: { x, y } })
    else if (field === 'arcEnd') store.updateEntityParams(id, { arcEndPoint: { x, y } })
    else if (field === 'arcCenter') store.updateEntityParams(id, { center: { x, y } })
    else if (bezierPointIndex !== null)
      store.updateEntityParams(id, { bezierPoint: { index: bezierPointIndex, value: { x, y } } })
    else if (field === 'ellipseCenter') store.updateEntityParams(id, { center: { x, y } })
    else store.updateEntityParams(id, { center: { x, y } })
  } else {
    const v = Number(acScalar.value)
    if (!Number.isFinite(v)) {
      cancelAcEdit()
      return
    }
    if (field === 'arcRadius' || field === 'circleRadius'){
      store.updateEntityParams(id, { radius: v })
    }
    else if (field === 'arcStartAngle') store.updateEntityParams(id, { startAngle: v })
    else if (field === 'arcEndAngle') store.updateEntityParams(id, { endAngle: v })
    else if (field === 'ellipseRadiusX') store.updateEntityParams(id, { radiusX: v })
    else if (field === 'ellipseRadiusY') store.updateEntityParams(id, { radiusY: v })
    else if (field === 'ellipseRotationDeg') store.updateEntityParams(id, { rotationDeg: v })
  }
  acEdit.value = null
}

const cancelAcEdit = () => {
  acEdit.value = null
}

const editForm = ref({
  openDirection: 'RIGHT' as OpenDirectionType,
  weldingName: '',
  baseHeight: 60,
  extrudeHeight: 0,
  openAngle: 0,
  openSize: 0,
  surfaceAngle: 0
})

const openEditParams = (entity: (typeof entities.value)[number]) => {
  editingEntityId.value = entity.id
  editForm.value = {
    openDirection: entity.openDirection,
    weldingName: entity.welding?.name ?? '',
    baseHeight: entity.baseHeight,
    extrudeHeight: entity.extrudeHeight,
    openAngle: entity.welding?.openAngle ?? 0,
    openSize: entity.welding?.openSize ?? 0,
    surfaceAngle: entity.surfaceAngle ?? 0
  }
  editModalOpen.value = true
}

const closeEditParams = () => {
  editModalOpen.value = false
  editingEntityId.value = null
}

const saveEditParams = () => {
  if (!editingEntityId.value) return
  store.updateEntityParams(editingEntityId.value, {
    openDirection: editForm.value.openDirection,
    baseHeight: editForm.value.baseHeight,
    extrudeHeight: editForm.value.extrudeHeight,
    surfaceAngle: editForm.value.surfaceAngle,
    welding: {
      name: editForm.value.weldingName,
      openAngle: editForm.value.openAngle,
      openSize: editForm.value.openSize
    }
  })
  closeEditParams()
}
// =================================编辑参数界面的参数及方法END========================================
// =================================编辑参数界面的参数及方法END========================================
// =================================编辑参数界面的参数及方法END========================================
// =================================编辑参数界面的参数及方法END========================================
// =================================编辑参数界面的参数及方法END========================================

const handleKeyDown = (event: KeyboardEvent) => {
  const key = event.key.toUpperCase()
  console.log(key)
  if (key === 'Z' && event.ctrlKey) {
    handleCanvasUndo()
  }
  if (key === 'Y' && event.ctrlKey) {
    handleCanvasRedo()
  }
  if (key === 'S' && event.ctrlKey) {
    handleCanvasSave(projectName.value)
  }
  if (key === 'N' && event.ctrlKey) {
    console.log('new')
  }
  if (key === 'O' && event.ctrlKey) {
    console.log('open')
  }
  if (key === 'C' && event.ctrlKey) {
  }
  if (key === 'V' && event.ctrlKey) {
  }
  if (event.key === 'Escape' || event.key === 'Esc' || key === 'S') {
    selectCanvas2DTool('fn-select')
  }
  if (key === 'DELETE') {
    handleCanvasDelete()
  }
  if (key === 'M' && !event.ctrlKey) {
    selectCanvas2DTool('fn-pan')
  }
  if (key === 'L' && !event.ctrlKey) {
    selectCanvas2DTool('draw-line')
  }
  if (key === 'A' && !event.ctrlKey) {
    selectCanvas2DTool('draw-arc')
  }
  if (key === 'C' && !event.ctrlKey) {
    selectCanvas2DTool('draw-circle')
  }
  if (key === 'B' && !event.ctrlKey) {
    selectCanvas2DTool('draw-bezier')
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
  document.addEventListener('mousedown', handleDocMouseDown)
  window.addEventListener('resize', updateFileMenuPos)
})
onUnmounted(() => {
  document.removeEventListener('mousedown', handleDocMouseDown)
  window.removeEventListener('resize', updateFileMenuPos)
  window.removeEventListener('keydown', handleKeyDown)
})
</script>
