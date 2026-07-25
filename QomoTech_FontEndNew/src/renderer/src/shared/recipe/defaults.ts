export const SubRecipeDefaults: Record<string, Record<string, unknown>> = {
  laser: { name: '', laserManufacturer: '', laserPower: 1000, laserFrequency: 5000, laserCurrent: 50 },
  blackening: {
    name: '',
    enabled: true,
    descentStep: 0.1,
    descentCount: 2,
    blackeningSpeed: 20,
    blackeningStep: 0.01,
    jiaojubuchang: 300,
    saoheikaikou: { k: 0, b: 0 },
    laserPowerRecipeId: ''
  },
  machining: { name: '', horizontalFormulaId: '', verticalFormulaId: '', laserPowerRecipeId: '' },
  horizontal: {
    name: '',
    openingShape: 'V型',
    angleFormula: { k: 0, b: 0.5 },
    lowerOpeningFormula: { k: 5, b: 35 },
    depthCompensationFormula: { k: 2, b: 0.5 },
    compensationAngleFormula: { k: 0, b: 0 },
    focusCompensation: 0.08
  },
  vertical: {
    name: '',
    cuttingAxis: 'XY',
    changePercent: 10,
    xFeed: 0.01,
    xSpeed: 20,
    edgeCutting: { speed: 50, cutTimes: 2, cutSpeedNums: 5, change: { k: 1, b: 5 } },
    middleCutting: { speed: 100, cutTimes: 1, change: { k: 0, b: 50 } },
    descentCutting: { speed: 0.075, zFeed: 0.002, change: { k: 10, b: 0.075 } }
  }
}

export const listKeyBySubType: Record<string, string> = {
  laser: 'laserPowerRecipes',
  blackening: 'blackeningRecipes',
  machining: 'machiningRecipes',
  horizontal: 'horizontalFormulaRecipes',
  vertical: 'verticalFormulaRecipes'
}
