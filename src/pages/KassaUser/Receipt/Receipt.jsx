import React, { forwardRef } from 'react';
import { X, Printer, Download } from 'lucide-react';

const Receipt = forwardRef(({ transaction, onClose, onPrint, onDownload }, ref) => {
  if (!transaction || !transaction.items || !Array.isArray(transaction.items)) {
    return (
      <div ref={ref} className="bg-white px-[6%] py-[4%] w-[95%] max-w-[600px] mx-auto rounded-xl shadow-2xl">
        <h1 className="text-[4vw] md:text-[1.5vw] font-bold text-red-600">Хатолик</h1>
        <p className="text-[3vw] md:text-[1vw] text-gray-600">Чек маълумотлари нотўғри ёки мавжуд эмас.</p>
        <button
          onClick={onClose}
          className="mt-[3%] w-full bg-gray-200 text-gray-700 py-[2%] rounded-lg hover:bg-gray-300 transition-colors duration-200 text-[3vw] md:text-[1vw]"
        >
          Ёпиш
        </button>
      </div>
    );
  }

  const formatAmount = (amount) => {
    const num = Math.floor(Number(amount) || 0);
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  };

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString('uz-UZ', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
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
      case 'INSTALLMENT': return 'Бўлиб тўлаш';
      default: return 'Номаълум';
    }
  };

  return (
    <div
      ref={ref}
      className="bg-white px-[6%] py-[4%] w-[96%] max-w-[1000px] mx-auto rounded-xl shadow-2xl"
      style={{ fontFamily: 'Arial, sans-serif' }}
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-[3%] pb-[2%] border-b border-gray-200">
        <div>
          <h1 className="text-[4vw] md:text-[1.5vw] font-bold text-gray-800">Чек #{transaction.id || 'Нома\'лум'}</h1>
          <p className="text-[2.5vw] md:text-[0.9vw] text-gray-600 mt-[1%]">{formatDate(transaction.createdAt || new Date())}</p>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-red-500 transition-colors duration-200">
          <X size={20} />
        </button>
      </div>

      {/* Transaction Info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[3%] mb-[3%]">
        <div className="space-y-[1.5%]">
          <div className="flex justify-between">
            <span className="font-medium text-gray-700 text-[2.5vw] md:text-[0.9vw]">Мижоз:</span>
            <span className="text-gray-900 text-[2.5vw] md:text-[0.9vw]">
              {transaction.customer?.fullName || `${transaction.customer?.firstName || ''} ${transaction.customer?.lastName || ''}`.trim()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="font-medium text-gray-700 text-[2.5vw] md:text-[0.9vw]">Телефон:</span>
            <span className="text-gray-900 text-[2.5vw] md:text-[0.9vw]">{transaction.customer?.phone || 'Нома\'лум'}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-medium text-gray-700 text-[2.5vw] md:text-[0.9vw]">Сотувчи:</span>
            <span className="text-gray-900 text-[2.5vw] md:text-[0.9vw]">
              {transaction.seller?.firstName} {transaction.seller?.lastName}
            </span>
          </div>
        </div>
        
        <div className="space-y-[1.5%]">
          <div className="flex justify-between">
            <span className="font-medium text-gray-700 text-[2.5vw] md:text-[0.9vw]">Филиал:</span>
            <span className="text-gray-900 text-[2.5vw] md:text-[0.9vw]">{transaction.branch?.name || 'Нома\'лум'}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-medium text-gray-700 text-[2.5vw] md:text-[0.9vw]">Тўлов тури:</span>
            <span className="text-gray-900 text-[2.5vw] md:text-[0.9vw]">{getPaymentTypeText(transaction.paymentType)}</span>
          </div>
          {transaction.paymentType === 'CREDIT' || transaction.paymentType === 'INSTALLMENT' ? (
            <div className="flex justify-between">
              <span className="font-medium text-gray-700 text-[2.5vw] md:text-[0.9vw]">Муддат:</span>
              <span className="text-gray-900 text-[2.5vw] md:text-[0.9vw]">{transaction.months || 0} ой</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Credit/Installment Details */}
      {(transaction.paymentType === 'CREDIT' || transaction.paymentType === 'INSTALLMENT') && (
        <div className="bg-blue-50 p-[2.5%] rounded-lg mb-[3%]">
          <h3 className="font-semibold text-blue-800 mb-[1.5%] text-[3vw] md:text-[1.2vw]">Кредит маълумотлари</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-[2%] text-[2.5vw] md:text-[0.9vw]">
            <div>
              <span className="text-blue-600">Асосий сумма:</span>
              <div className="font-medium">{formatAmount(transaction.total)}</div>
            </div>
            <div>
              <span className="text-blue-600">Фоиз:</span>
              <div className="font-medium">{transaction.interestRate || 0}%</div>
            </div>
            <div>
              <span className="text-blue-600">Тўланган:</span>
              <div className="font-medium">{formatAmount(transaction.paid || 0)}</div>
            </div>
            <div>
              <span className="text-blue-600">Қолган:</span>
              <div className="font-medium">{formatAmount(transaction.remaining || 0)}</div>
            </div>
          </div>
          {transaction.monthlyPayment && (
            <div className="mt-[1.5%] pt-[1.5%] border-t border-blue-200">
              <span className="text-blue-600 font-medium text-[2.5vw] md:text-[0.9vw]">Ойлик тўлов: </span>
              <span className="font-bold text-blue-800">{formatAmount(transaction.monthlyPayment)}</span>
            </div>
          )}
        </div>
      )}

      {/* Products Table */}
      <div className="mb-[3%]">
        <h2 className="text-[3.5vw] md:text-[1.3vw] font-semibold text-gray-800 mb-[1.5%]">Маҳсулотлар</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[2.5vw] md:text-[0.9vw]">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-[1.5%] text-left font-medium border border-gray-200">№</th>
                <th className="p-[1.5%] text-left font-medium border border-gray-200">Маҳсулот</th>
                <th className="p-[1.5%] text-left font-medium border border-gray-200">Нарх</th>
                <th className="p-[1.5%] text-left font-medium border border-gray-200">Миқдор</th>
                <th className="p-[1.5%] text-left font-medium border border-gray-200">Жами</th>
              </tr>
            </thead>
            <tbody>
              {transaction.items.map((item, index) => (
                <tr key={index} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="p-[1.5%] border border-gray-200">{index + 1}</td>
                  <td className="p-[1.5%] border border-gray-200 font-medium">{item.name}</td>
                  <td className="p-[1.5%] border border-gray-200">{formatAmount(item.price)}</td>
                  <td className="p-[1.5%] border border-gray-200 text-center">{item.quantity}</td>
                  <td className="p-[1.5%] border border-gray-200 font-medium">
                    {formatAmount(Number(item.quantity) * Number(item.price))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Total */}
      <div className="border-t pt-[2.5%] mb-[3%]">
        <div className="flex justify-between items-center text-[3.5vw] md:text-[1.3vw]">
          <span className="font-semibold text-gray-700">Жами:</span>
          <span className="font-bold text-gray-900 text-[4vw] md:text-[1.5vw]">
            {formatAmount(transaction.finalTotal || transaction.total)}
          </span>
        </div>
        
        {(transaction.paymentType === 'CREDIT' || transaction.paymentType === 'INSTALLMENT') && (
          <div className="mt-[1.5%] text-[2.5vw] md:text-[0.9vw] text-gray-600">
            <div className="flex justify-between">
              <span>Асосий сумма:</span>
              <span>{formatAmount(transaction.total)}</span>
            </div>
            <div className="flex justify-between">
              <span>Фоиз билан:</span>
              <span>{formatAmount(transaction.finalTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Тўланган:</span>
              <span>{formatAmount(transaction.paid || 0)}</span>
            </div>
            <div className="flex justify-between font-medium">
              <span>Қолган:</span>
              <span>{formatAmount(transaction.remaining || 0)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-[2%]">
        <button
          onClick={onClose}
          className="flex-1 bg-gray-200 text-gray-700 py-[2%] rounded-lg hover:bg-gray-300 transition-colors duration-200 font-medium text-[2.5vw] md:text-[0.9vw]"
        >
          Ёпиш
        </button>
        {onPrint && (
          <button
            onClick={onPrint}
            className="flex-1 bg-blue-500 text-white py-[2%] rounded-lg hover:bg-blue-600 transition-colors duration-200 font-medium flex items-center justify-center gap-[1%] text-[2.5vw] md:text-[0.9vw]"
          >
            <Printer size={18} />
            Чоп этиш
          </button>
        )}
        {onDownload && (
          <button
            onClick={onDownload}
            className="flex-1 bg-green-500 text-white py-[2%] rounded-lg hover:bg-green-600 transition-colors duration-200 font-medium flex items-center justify-center gap-[1%] text-[2.5vw] md:text-[0.9vw]"
          >
            <Download size={18} />
            Юклаб олиш
          </button>
        )}
      </div>
    </div>
  );
});

Receipt.displayName = 'Receipt';

export default Receipt;
