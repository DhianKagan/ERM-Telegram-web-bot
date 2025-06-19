/**
 * Назначение: демонстрационная страница без внешнего контента.
 * Модули: компоненты AdminJS для отображения записи.
 */
import { Box, H3, Text } from '@adminjs/design-system';
import { BasePropertyProps } from 'adminjs';
import React from 'react';

const DontTouchThis = (props: BasePropertyProps) => {
  const { record } = props;

  return (
    <Box flex flexDirection={['column', 'column', 'column', 'row']} style={{ gap: 16 }}>
      <Box variant="container" boxShadow="card">
        <H3>Example of a simple page</H3>
        <Text>Where you can put almost everything like this:</Text>
        <Box as="div" />
      </Box>
      <Box variant="container" boxShadow="card">
        <Text>Or (more likely), operate on a returned record:</Text>
        <Box maxHeight={500} overflowY="scroll">
          <pre style={{ fontFamily: 'monospace' }}>{JSON.stringify(record, null, 2)}</pre>
        </Box>
      </Box>
    </Box>
  );
};

export default DontTouchThis;
