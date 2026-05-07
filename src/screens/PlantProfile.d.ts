export interface Plant {
  id: string
  common_name: string
  latin_name: string
  sun_requirements: string
  soil_type: string
  aspect: string
  height: string
  flowering_season: string
  growth_rate: string
  hardiness: string
  soil_ph?: string
  toxic?: string
  photo_url?: string
  companions: string[]
  care_calendar: {
    [month: number]: { action: string }[]
  }
  wildlife_value?: string
}

export interface PlantProfileState {
  plant?: Plant
  probability?: number
}

// Component type declaration for JSX import
declare module './PlantProfile' {
  import { ComponentType } from 'react'
  const PlantProfile: ComponentType<any>
  export default PlantProfile
}
