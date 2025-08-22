<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ yarn install
```

## Compile and run the project

```bash
# development
$ yarn run start

# watch mode
$ yarn run start:dev

# production mode
$ yarn run start:prod
```

## Run tests

```bash
# unit tests
$ yarn run test

# e2e tests
$ yarn run test:e2e

# test coverage
$ yarn run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ yarn install -g mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).

# AminovProject

## Database Migration Instructions

After updating the Prisma schema to include the new `transactionType` field and passport fields, you need to run the following commands to update your database:

### 1. Generate Prisma Client
```bash
npm run db:generate
```

### 2. Push Schema Changes to Database
```bash
npm run db:push
```

### 3. (Alternative) Create and Run Migration
```bash
npm run db:migrate
```

### 4. Open Prisma Studio (Optional)
```bash
npm run db:studio
```

### New Fields Added:
- **Transaction Model**: `transactionType` (String, optional)
- **Customer Model**: `passportSeries` (String, optional), `jshshir` (String, optional)

### Database Indexes Added:
- `passportSeries` and `jshshir` fields are indexed for better search performance

## New Features Added

### Transaction Type Management
- Added `transactionType` field to Transaction model
- Supports multiple transaction types: SALE, PURCHASE, TRANSFER, RETURN, STOCK_ADJUSTMENT, WRITE_OFF
- Frontend form now includes transaction type selection
- Backend DTOs and services updated to handle transaction types
- Receipt and PDF generation now includes transaction type information

### Customer Passport Information
- Added `passportSeries` field to Customer model for storing passport series numbers
- Added `jshshshir` field to Customer model for storing JSHSHIR numbers
- Frontend forms in both SalesManagement.jsx and Chiqim.jsx now include passport fields
- Passport information is saved to backend and displayed in receipts and PDFs
- Both fields are optional and indexed for better search performance

### Updated Components
- `SalesManagement.jsx` - Now supports different transaction types and passport information
- `Chiqim.jsx` - Added passport fields for customer information
- `Mijozlar.jsx` - Added search functionality and scrollable data
- Backend transaction service and DTOs updated
- Customer model enhanced with passport fields

## Running the Application

1. Install dependencies: `npm install`
2. Set up environment variables (DATABASE_URL, etc.)
3. Run database migration: `npm run db:push`
4. Start the backend: `npm run start:dev`
5. Open the frontend in your browser

## API Endpoints

The application now supports creating transactions with different types through the `/transactions` endpoint.

```

# Aminov Project - Defective Product Management System

## Overview
This project implements a simplified defective product management system with cash flow tracking, customer search, and credit payment monitoring for retail businesses.

## Features

### 🚨 Defective Product Management
- **Defect Marking**: Mark products as defective with quantity validation
- **Cash Flow Tracking**: Automatic cash deduction from register when products become defective
- **Quantity Validation**: Prevents marking more defective items than available stock

### 🔧 Product Repair & Recovery
- **Fix Tracking**: Mark defective products as fixed
- **Cash Recovery**: Automatic cash addition to register when products are fixed
- **Status Management**: Track product status changes (IN_STORE → DEFECTIVE → FIXED)

### 📦 Returns & Exchanges
- **Product Returns**: Process customer returns with cash refunds
- **Product Exchanges**: Handle product exchanges with cash adjustments
- **Cash Flow Impact**: Automatic cash register updates for all operations

### 💰 Cash Register Management
- **Main Cash Register**: Track cash balance for selected date range
- **Automatic Updates**: Cash balance updates automatically with each operation
- **Cash Flow Tracking**: Monitor impact of defective operations on cash

### 💳 Customer & Credit Management
- **Customer Search**: Search by phone number or full name
- **Credit Tracking**: Monitor customer credit payments and balances
- **Transaction History**: View customer purchase history

### 📊 Simplified Dashboard
- **Cash Register**: Main cash balance for selected period
- **Defective Statistics**: Count of defective, fixed, returned, and exchanged items
- **Cash Flow Impact**: Total cash flow from defective operations
- **Credit Summary**: Basic credit payment statistics

## Technical Implementation

### Backend (NestJS + Prisma)

#### Database Schema Updates
```prisma
model Branch {
  id          Int      @id @default(autoincrement())
  name        String
  address     String?
  // ... other fields
}

model Product {
  id                Int            @id @default(autoincrement())
  // ... existing fields
  defectiveQuantity Int            @default(0)
  returnedQuantity  Int            @default(0) // Return tracking
  exchangedQuantity Int            @default(0) // Exchange tracking
  // ... other fields
}

model DefectiveLog {
  id          Int      @id @default(autoincrement())
  productId   Int
  quantity    Int
  description String
  userId      Int?
  branchId    Int?     // Branch association
  cashAmount  Float    @default(0) // Cash flow tracking
  actionType  String   @default("DEFECTIVE") // Operation type
  // ... other fields
}
```

#### API Endpoints

##### Defective Log Management
- `POST /defective-logs` - Create defective log entry
- `GET /defective-logs/statistics` - Get defective product statistics
- `POST /defective-logs/mark-as-fixed/:productId` - Mark product as fixed
- `POST /defective-logs/return/:productId` - Process product return
- `POST /defective-logs/exchange/:productId` - Process product exchange

##### Customer Management
- `GET /customers?phone={phone}` - Search customer by phone
- `GET /customers?fullName={name}` - Search customer by name
- `GET /transactions?customerId={id}&branchId={branchId}` - Get customer transactions

### Frontend (React)

#### Components
- **DefectiveManagement.jsx**: Complete defective product management interface
- **Dashboard.jsx**: Simplified statistics and cash flow display

#### Key Features
- **Action Panel**: Select operation type, product, quantity, and description
- **Real-time Validation**: Prevent invalid operations
- **Customer Search**: Search by phone or name with transaction history
- **Sold Products Tab**: View products that have been sold
- **Visual Feedback**: Color-coded status indicators

## Business Logic

### Cash Flow Rules

#### Defective Products
- **When marked defective**: Cash decreases by (product price × quantity)
- **When fixed**: Cash increases by (product price × quantity)
- **Quantity validation**: Cannot mark more defective than available stock

#### Returns & Exchanges
- **Returns**: Cash decreases by (product price × quantity)
- **Exchanges**: Cash increases by (product price × quantity)
- **Status tracking**: Products marked as RETURNED or EXCHANGED

#### Credit Payments
- **Payment tracking**: Monitor credit transactions per customer
- **Balance calculation**: Track remaining credit amounts
- **Customer history**: View all customer transactions

### Data Validation
- **Quantity limits**: Prevent operations exceeding available stock
- **Branch association**: All operations tied to specific branch
- **User tracking**: Log all operations with user identification
- **Audit trail**: Complete history of all cash movements

## Usage Examples

### Marking Product as Defective
1. Select "Defekt qilish" action type
2. Choose product from dropdown
3. Enter quantity (validated against available stock)
4. Add description/notes
5. Submit - cash automatically deducted from register

### Customer Search
1. Go to "Mijoz qidirish" tab
2. Select search type (phone or name)
3. Enter search term
4. Click search button
5. Select customer from results
6. View transaction history and credit status

### Monitoring Cash Flow
- Dashboard shows main cash register balance
- Cash flow impact from defective operations
- Defective product statistics
- Basic credit payment information

## Installation & Setup

### Prerequisites
- Node.js 16+
- PostgreSQL database
- Prisma CLI

### Backend Setup
```bash
cd src
npm install
npx prisma generate
npx prisma db push
npm run start:dev
```

### Frontend Setup
```bash
npm install
npm start
```

### Environment Variables
```env
DATABASE_URL="postgresql://user:password@localhost:5432/dbname"
JWT_SECRET="your-jwt-secret"
```

## Security Features
- JWT authentication for all API endpoints
- User role-based access control
- Branch-specific data isolation
- Audit logging for all operations

## Key Benefits
- **Simplified Interface**: Focus on essential operations
- **Real-time Cash Tracking**: Automatic cash register updates
- **Customer Management**: Easy customer search and credit tracking
- **Defective Product Control**: Comprehensive defect management
- **Cash Flow Transparency**: Clear visibility of all cash movements

## System Flow

1. **Product Sale**: Customer purchases product
2. **Defect Detection**: Product marked as defective
3. **Cash Impact**: Cash automatically deducted from register
4. **Product Repair**: Product fixed and cash added back
5. **Returns/Exchanges**: Process customer returns with cash adjustments
6. **Dashboard Monitoring**: Track all cash movements and statistics

---

**Note**: This system is designed for retail businesses requiring simple but effective defective product management with automatic cash flow tracking. The main cash register (Кассадаги пул) remains accurate and reflects all operations automatically.
