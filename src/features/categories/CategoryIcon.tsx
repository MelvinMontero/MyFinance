import {
  Briefcase,
  Car,
  Coffee,
  DollarSign,
  Gift,
  Heart,
  Home,
  Laptop,
  MoreHorizontal,
  Music,
  Shield,
  ShoppingBag,
  Tv,
  Utensils,
  Zap,
} from 'lucide-react-native';
import type { ComponentType } from 'react';

interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

const ICON_MAP: Record<string, ComponentType<IconProps>> = {
  // Ingresos
  briefcase: Briefcase,
  laptop: Laptop,
  gift: Gift,
  'dollar-sign': DollarSign,
  // Fijos
  home: Home,
  zap: Zap,
  tv: Tv,
  car: Car,
  shield: Shield,
  // Variables
  utensils: Utensils,
  coffee: Coffee,
  music: Music,
  'shopping-bag': ShoppingBag,
  heart: Heart,
  'more-horizontal': MoreHorizontal,
};

/**
 * Renderiza el icono lucide correspondiente al string del seed.
 * Si no existe en el mapa, usa MoreHorizontal como fallback.
 */
export function CategoryIcon({
  name,
  size = 20,
  color = '#475569',
  strokeWidth = 2,
}: IconProps & { name: string }) {
  const Component = ICON_MAP[name] ?? MoreHorizontal;
  return <Component size={size} color={color} strokeWidth={strokeWidth} />;
}
