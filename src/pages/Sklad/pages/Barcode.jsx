import React from 'react';
import ReactBarcode from 'react-barcode';

const Barcode = ({
  value,
  format = 'CODE128',
  width = 2,
  height = 100,
  displayValue = true,
  ...rest
}) => {
  if (!value) return null;
  return (
    <ReactBarcode
      value={String(value)}
      format={format}
      width={width}
      height={height}
      displayValue={displayValue}
      {...rest}
    />
  );
};

export default Barcode;