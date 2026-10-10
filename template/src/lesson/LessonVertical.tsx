import React from 'react';
import {Lesson, type LessonProps} from './Lesson';

export type LessonVerticalProps = LessonProps;

export const LessonVertical: React.FC<LessonVerticalProps> = (props) => (
  <Lesson {...props} orientation="vertical" />
);
