import React from 'react';
import { BustPoseType } from './bust/z_options';
import { SittingPoseType } from './sitting/z_options';
import { StandingPoseType } from './standing/z_options';
interface PoseProps {
    piece: BustPoseType | SittingPoseType | StandingPoseType;
    strokeColor?: string;
    backgroundColor?: string;
}
declare const index: React.FC<PoseProps>;
export default index;
