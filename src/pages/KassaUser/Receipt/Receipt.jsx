import React, { forwardRef, useState } from 'react';
import { X, Printer } from 'lucide-react';
import { formatAmountSom } from '../../../utils/currencyFormat';

const Receipt = forwardRef(({ transaction, onClose, onPrint }, ref) => {
  const [isProcessing, setIsProcessing] = useState(false);
  if (!transaction || !transaction.items || !Array.isArray(transaction.items)) {
    return (
      <div ref={ref} className="bg-white px-4 sm:px-6 md:px-8 py-4 sm:py-6 w-full max-w-3xl mx-auto rounded-2xl shadow-2xl font-sans">
        <h1 className="text-xl sm:text-2xl font-extrabold text-red-600">Хатолик</h1>
        <p className="text-sm sm:text-base text-gray-600 mt-2">Чек маълумотлари нотўғри ёки мавжуд эмас.</p>
        <button
          onClick={onClose}
          className="no-print mt-4 w-full bg-gray-200 text-gray-800 py-2 sm:py-3 rounded-lg hover:bg-gray-300 transition-colors duration-200 font-semibold text-sm sm:text-base"
        >
          Ёпиш
        </button>
      </div>
    );
  }

  const calculateTotal = () => {
    if (!transaction.items || !Array.isArray(transaction.items)) return 0;
    return transaction.items.reduce((sum, item) => {
      const unitPriceSom = Number(item.price ?? item.marketPrice) || 0;
      const quantityNum = Number(item.quantity) || 0;
      const lineTotalSom = Number(item.total) || unitPriceSom * quantityNum;
      return sum + lineTotalSom;
    }, 0);
  };

  const actualTotal = calculateTotal();

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString('uz-UZ', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Tashkent',
      });
    } catch {
      return 'Номаълум';
    }
  };

  const getPaymentTypeText = (paymentType) => {
    switch (paymentType) {
      case 'CASH': return 'Нақд';
      case 'CARD': return 'Карта';
      case 'CREDIT': return 'Кредит';
      case 'INSTALLMENT': return "Бўлиб тўлаш";
      default: return 'Номаълум';
    }
  };

  const getDeliveryTypeText = (deliveryType) => {
    switch (deliveryType) {
      case 'PICKUP': return 'Олиб кетиш';
      case 'DELIVERY': return 'Етказиб бериш';
      default: return 'Номаълум';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="w-full max-w-2xl lg:max-w-3xl max-h-[95vh] overflow-y-auto bg-white rounded-lg shadow-2xl">
        <div ref={ref} className="bg-white px-3 sm:px-4 md:px-6 py-3 sm:py-4 md:py-6 w-full mx-auto font-sans text-sm sm:text-base">
      <style>{`
        @media print {
          .shadow-2xl { box-shadow: none; }
          .bg-gray-100, .bg-gray-50, .bg-blue-50 { background-color: transparent !important; }
          .text-gray-600, .text-gray-700, .text-gray-800, .text-gray-900 { color: #000 !important; }
          .rounded-2xl { border-radius: 0; }
          .px-4, .px-6, .px-8, .px-10 { padding-left: 0 !important; padding-right: 0 !important; }
          .py-4, .py-6 { padding-top: 0 !important; padding-bottom: 0 !important; }
          .max-w-3xl, .max-w-4xl { max-width: none !important; width: 100% !important; }
          .no-print { display: none !important; }
        }
      `}</style>

          {/* Header */}
          <div className="flex justify-between items-center mb-3 pb-2 border-b-2 border-gray-200">
            <div>
              <h1 className="text-lg sm:text-xl md:text-2xl font-extrabold text-gray-900">
                Чек #{transaction.id || 'Номаълум'}
              </h1>
            </div>
            <button onClick={onClose} className="no-print text-gray-600 hover:text-red-600 transition-colors duration-200">
              <X size={20} />
            </button>
          </div>

          {/* Transaction Info */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="font-semibold text-gray-700 text-xs sm:text-sm">Мижоз:</span>
                <span className="text-gray-900 text-xs sm:text-sm font-medium break-words max-w-[60%] text-right">
                  {transaction.customer?.fullName ||
                    `${transaction.customer?.firstName || ''} ${transaction.customer?.lastName || ''}`.trim() ||
                    'Номаълум'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-gray-700 text-xs sm:text-sm">Телефон:</span>
                <span className="text-gray-900 text-xs sm:text-sm font-medium break-words max-w-[60%] text-right">
                  {transaction.customer?.phone || 'Номаълум'}
                </span>
              </div>
              {transaction.customer?.passportSeries && (
                <div className="flex justify-between">
                  <span className="font-semibold text-gray-700 text-xs sm:text-sm">Паспорт:</span>
                  <span className="text-gray-900 text-xs sm:text-sm font-medium break-words max-w-[60%] text-right">
                    {transaction.customer.passportSeries}
                  </span>
                </div>
              )}
              {transaction.customer?.jshshir && (
                <div className="flex justify-between">
                  <span className="font-semibold text-gray-700 text-xs sm:text-sm">JSHSHIR:</span>
                  <span className="text-gray-900 text-xs sm:text-sm font-medium break-words max-w-[60%] text-right">{transaction.customer.jshshir}</span>
                </div>
              )}
            </div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="font-semibold text-gray-700 text-xs sm:text-sm">Филиал:</span>
                <span className="text-gray-900 text-xs sm:text-sm font-medium break-words max-w-[60%] text-right">
                  {transaction.branch?.name || 'Номаълум'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-gray-700 text-xs sm:text-sm">Сотувчи:</span>
                <span className="text-gray-900 text-xs sm:text-sm font-medium break-words max-w-[60%] text-right">
                  {transaction.seller
                    ? `${transaction.seller.firstName} ${transaction.seller.lastName}`.trim()
                    : 'Номаълум'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-gray-700 text-xs sm:text-sm">Тўлов тури:</span>
                <span className="text-gray-900 text-xs sm:text-sm font-medium break-words max-w-[60%] text-right">
                  {getPaymentTypeText(transaction.paymentType)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-gray-700 text-xs sm:text-sm">Етказиб бериш:</span>
                <span className="text-gray-900 text-xs sm:text-sm font-medium break-words max-w-[60%] text-right">
                  {getDeliveryTypeText(transaction.deliveryType)}
                </span>
              </div>
              {transaction.deliveryAddress && (
                <div className="flex justify-between">
                  <span className="font-semibold text-gray-700 text-xs sm:text-sm">Манзил:</span>
                  <span className="text-gray-900 text-xs sm:text-sm font-medium break-words max-w-[60%] text-right">
                    {transaction.deliveryAddress}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Credit/Installment Details */}
          {(transaction.paymentType === 'CREDIT' || transaction.paymentType === 'INSTALLMENT') && (
            <div className="bg-blue-50 p-3 rounded-lg mb-3">
              <h3 className="font-bold text-blue-800 mb-2 text-sm sm:text-base">Кредит маълумотлари</h3>
              <div className="grid grid-cols-2 gap-2 text-xs sm:text-sm">
                <div>
                  <span className="text-blue-600 font-medium block">Асосий сумма:</span>
                  <div className="font-semibold">
                    {formatAmountSom(actualTotal)}
                  </div>
                </div>
                {!(transaction.paymentType === 'INSTALLMENT' && transaction.termUnit === 'DAYS') && (
                  <div>
                    <span className="text-blue-600 font-medium block">Фоиз:</span>
                    <div className="font-semibold">{transaction.interestRate || 0}%</div>
                  </div>
                )}
                <div>
                  <span className="text-blue-600 font-medium block">Тўланган:</span>
                  <div className="font-semibold">
                    {formatAmountSom(transaction.paid || 0)}
                  </div>
                </div>
                <div>
                  <span className="text-blue-600 font-medium block">Қолган:</span>
                  <div className="font-semibold">
                    {formatAmountSom(transaction.remaining || 0)}
                  </div>
                </div>
                {transaction.paymentType === 'INSTALLMENT' && (transaction.termUnit === 'DAYS' || transaction.days) ? (
                  <>
                    <div>
                      <span className="text-blue-600 font-medium block">Муддат:</span>
                      <div className="font-semibold">{transaction.days || 0} кун</div>
                    </div>
                    <div>
                      <span className="text-blue-600 font-medium block">Кунлик тўлов:</span>
                      <div className="font-semibold">{formatAmountSom(transaction.monthlyPayment || 0)}</div>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <span className="text-blue-600 font-medium block">Муддат:</span>
                      <div className="font-semibold">{transaction.months || 0} ой</div>
                    </div>
                    <div>
                      <span className="text-blue-600 font-medium block">Ойлик тўлов:</span>
                      <div className="font-semibold">{formatAmountSom(transaction.monthlyPayment || 0)}</div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Products Table */}
          <div className="mb-3">
            <h2 className="text-sm sm:text-base font-bold text-gray-800 mb-2">Маҳсулотлар</h2>
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="p-1 text-left font-semibold border border-gray-300">№</th>
                    <th className="p-1 text-left font-semibold border border-gray-300">Маҳсулот</th>
                    <th className="p-1 text-left font-semibold border border-gray-300">Нарх</th>
                    <th className="p-1 text-left font-semibold border border-gray-300">Миқдор</th>
                    <th className="p-1 text-left font-semibold border border-gray-300">Жами</th>
                  </tr>
                </thead>
                <tbody>
                  {transaction.items.map((item, index) => (
                    <tr key={index} className={`border-b border-gray-300 ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}>
                      <td className="p-1 border border-gray-300">{index + 1}</td>
                      <td className="p-1 border border-gray-300 font-semibold">{item.name}</td>
                      <td className="p-1 border border-gray-300">{formatAmountSom(item.price ?? item.marketPrice)}</td>
                      <td className="p-1 border border-gray-300 text-center">{item.quantity}</td>
                      <td className="p-1 border border-gray-300 font-semibold">
                        {formatAmountSom((Number(item.total) || (Number(item.price ?? item.marketPrice) * Number(item.quantity))))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="block sm:hidden space-y-2">
              {transaction.items.map((item, index) => (
                <div key={index} className="border border-gray-300 rounded-lg p-2 bg-gray-50">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold">№:</span>
                    <span>{index + 1}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold">Маҳсулот:</span>
                    <span className="font-semibold break-words max-w-[60%] text-right">{item.name}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold">Нарх:</span>
                    <span>{formatAmountSom(item.price ?? item.marketPrice)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold">Миқдор:</span>
                    <span>{item.quantity}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold">Жами:</span>
                    <span className="font-semibold">
                      {formatAmountSom((Number(item.total) || (Number(item.price ?? item.marketPrice) * Number(item.quantity))))}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Total */}
          <div className="border-t-2 pt-2 mb-3">
            <div className="flex justify-between items-center text-sm sm:text-base font-bold">
              <span className="text-gray-800">Жами:</span>
              <span className="text-gray-900">
                {formatAmountSom(actualTotal)}
              </span>
            </div>
            {(transaction.paymentType === 'CREDIT' || transaction.paymentType === 'INSTALLMENT') && (
              <div className="mt-2 text-xs sm:text-sm text-gray-600 space-y-1">
                <div className="flex justify-between">
                  <span>Асосий сумма:</span>
                  <span className="font-semibold">
                    {formatAmountSom(actualTotal)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Фоиз билан:</span>
                  <span className="font-semibold">
                    {formatAmountSom(transaction.finalTotalInSom || transaction.finalTotal || actualTotal)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Олдиндан тўлов:</span>
                  <span className="font-semibold">
                    {formatAmountSom(transaction.paid || 0)}
                  </span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Қолган (фоиз билан):</span>
                  <span>
                    {formatAmountSom(transaction.remaining || 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>{(transaction.paymentType === 'INSTALLMENT' && (transaction.termUnit === 'DAYS' || transaction.days)) ? 'Кунлик тўлов:' : 'Ойлик тўлов:'}</span>
                  <span className="font-semibold">
                    {formatAmountSom(transaction.monthlyPayment || 0)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={onClose}
              className="no-print flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg hover:bg-gray-300 transition-colors duration-200 font-semibold text-sm"
            >
              Ёпиш
            </button>
            {onPrint && (
              <button
                onClick={() => {
                  if (isProcessing) return;
                  setIsProcessing(true);
                  const maybePromise = onPrint();
                  if (maybePromise && typeof maybePromise.then === 'function') {
                    // Do not re-enable to ensure one-time action per sale
                    maybePromise.catch(() => {}).then(() => {});
                  }
                }}
                disabled={isProcessing}
                className={`no-print flex-1 bg-blue-600 text-white py-2 rounded-lg transition-colors duration-200 font-semibold flex items-center justify-center gap-1.5 text-sm ${isProcessing ? 'opacity-60 cursor-not-allowed' : 'hover:bg-blue-700'}`}
              >
                <Printer size={16} />
                Сотиш ва Чоп этиш
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

Receipt.displayName = 'Receipt';

export default Receipt;