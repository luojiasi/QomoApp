<script setup lang="ts">
function handleMinimize(): void {window.electron?.ipcRenderer?.send('window-control', 'minimize')}
function handleMaximize(): void {window.electron?.ipcRenderer?.send('window-control', 'maximize')}
function handleClose(): void {window.electron?.ipcRenderer?.send('window-control', 'close')}
</script>

<template>
  <button
    class="flex h-4 w-4 cursor-pointer items-center justify-center rounded-full bg-yellow-500 shadow"
    type="button"
    @click="handleMinimize"
  />
  <button
    class="flex h-4 w-4 cursor-pointer items-center justify-center rounded-full bg-green-500 shadow"
    type="button"
    @click="handleMaximize"
  />
  <button
    class="flex h-4 w-4 cursor-pointer items-center justify-center rounded-full bg-red-500 shadow"
    type="button"
    @click="handleClose"
  />
</template>
