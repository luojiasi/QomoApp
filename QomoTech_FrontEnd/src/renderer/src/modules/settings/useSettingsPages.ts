import { computed } from 'vue'
import { createControllerSections, createRecipeSections } from '@/configs/settings'
import { deviceFeatureRoutes } from '@/app/router'
import { useControllerSettingsStore } from '@/modules/motion/useMotionStore'
import { useRecipeSettingsStore } from '@/modules/recipe/useRecipeStore'
import { useReservePagesStore } from '@/modules/settings/useSettingsStore'

export const useControllerSettingsPage = () => {
  const controllerStore = useControllerSettingsStore()

  return {
    navigationLinks: deviceFeatureRoutes,
    controllerSettings: computed(() => controllerStore.controllerSettings),
    sections: computed(() => createControllerSections(controllerStore.controllerSettings))
  }
}

export const useRecipeManagementPage = () => {
  const recipeStore = useRecipeSettingsStore()

  return {
    navigationLinks: deviceFeatureRoutes,
    recipeState: computed(() => recipeStore.recipeState),
    sections: computed(() => createRecipeSections(recipeStore.recipeState))
  }
}

export const useReservePages = () => {
  const reserveStore = useReservePagesStore()

  return {
    navigationLinks: deviceFeatureRoutes,
    reservePages: computed(() => reserveStore.reservePages),
    getReservePageByPath: (path: string) =>
      reserveStore.reservePages.find((page) => page.path === path) ?? reserveStore.reservePages[0]
  }
}
