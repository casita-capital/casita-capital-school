import { useContext } from 'react';
import { CustomizationContext } from 'src/contexts/customization';

export const useCustomization = () => useContext(CustomizationContext);
