const { Sequelize } = require('sequelize');
const pgSequelize = new Sequelize('postgres://user:pass@localhost:5432/db');
const quoteIdentifier = pgSequelize.getQueryInterface().queryGenerator.quoteIdentifier;

console.log("quoteIdentifier('discountAmount'):", quoteIdentifier('discountAmount'));
console.log("quoteIdentifier('customer_invoices'):", quoteIdentifier('customer_invoices'));
