import React from 'react';
import { HairType } from '../hair/z_options';
import { FaceType } from '../face/z_options';
import { FacialHairType } from '../facialHair/z_options';
import { AccessoryType } from '../accessories/z_options';
interface HeadProps {
    hairPiece?: HairType;
    facePiece?: FaceType;
    facialHairPiece?: FacialHairType;
    accessoryPiece?: AccessoryType;
    strokeColor?: string;
    backgroundColor?: string;
}
declare const index: React.FC<HeadProps>;
export default index;
