import React from 'react';
import ReactBarcode from 'react-barcode';

const Barcode = ({
  value,
  format = 'CODE128',
  width = 2,
  height = 100,
  displayValue = true,
  productName,
  price,
  ...rest
}) => {
  if (!value) return null;
  return (
    <div className="text-center">
      {productName && (
        <div className="text-sm font-semibold text-gray-900 mb-1">
          {productName}
        </div>
      )}
      {price && (
        <div className="text-sm font-bold text-gray-800 mb-2">
          {price}
        </div>
      )}
      <div className="flex justify-center">
        <ReactBarcode
          value={String(value)}
          format={format}
          width={width}
          height={height}
          displayValue={displayValue}
          {...rest}
        />
      </div>
    </div>
  );
};

export default Barcode;