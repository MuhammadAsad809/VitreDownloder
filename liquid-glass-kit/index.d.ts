import React from 'react';
import { ViewProps, StyleProp, ViewStyle } from 'react-native';

export const isLiquidGlassSupported: boolean;
export function LiquidGlassProvider(props: ViewProps & { providerId?: string; children?: React.ReactNode }): React.ReactElement;
export interface LiquidGlassViewProps extends ViewProps {
  interactive?: boolean;
  chromaticAberration?: number;
  intensity?: 'light' | 'medium' | 'heavy';
  borderRadius?: number;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function LiquidGlassView(props: LiquidGlassViewProps): React.ReactElement;
