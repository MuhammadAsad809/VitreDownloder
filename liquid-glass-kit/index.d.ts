import React from 'react';
import { ViewProps } from 'react-native';

export const isLiquidGlassSupported: boolean;
export function LiquidGlassProvider(props: ViewProps & { providerId?: string; children?: React.ReactNode }): React.ReactElement;
export function LiquidGlassView(props: ViewProps & { interactive?: boolean; chromaticAberration?: number; children?: React.ReactNode }): React.ReactElement;
