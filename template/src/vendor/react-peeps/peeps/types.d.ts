export interface PieceType {
    strokeColor?: string;
    backgroundColor?: string;
}
export declare type GradientType = {
    type?: 'RadialGradient' | 'LinearGradient';
    degree?: number;
    firstColor: string;
    secondColor: string;
};
