const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const yahooFinance = require('yahoo-finance2').default;

// Suppress Yahoo Finance survey notice
yahooFinance.suppressNotices(['yahooSurvey']);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware - use simpler CORS configuration that accepts all origins
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Routes
app.get('/api/stock/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;

        // Only fetch quoteSummary as it has most of the data we need
        const quoteSummary = await yahooFinance.quoteSummary(symbol, {
            modules: ['summaryProfile', 'defaultKeyStatistics', 'financialData', 'price', 'summaryDetail']
        });
        
        // Financial data is part of quoteSummary
        const financialData = quoteSummary.financialData || {};
        const summaryProfile = quoteSummary.summaryProfile || {};
        const defaultKeyStatistics = quoteSummary.defaultKeyStatistics || {};
        const price = quoteSummary.price || {};
        const summaryDetail = quoteSummary.summaryDetail || {};
        
        // Process and format the data
        const stockData = {
            symbol: price.symbol || symbol,
            name: price.longName || price.shortName || symbol,
            sector: summaryProfile.sector || 'N/A',
            industry: summaryProfile.industry || 'N/A',
            location: summaryProfile.country || 'N/A',
            website: summaryProfile.website || 'N/A',
            exchange: price.exchangeName || 'N/A',
            forwardPE: defaultKeyStatistics.forwardPE || summaryDetail.forwardPE || null,
            trailingPE: defaultKeyStatistics.trailingPE || summaryDetail.trailingPE || null,
            priceToBook: defaultKeyStatistics.priceToBook || null,
            ebitda: financialData.ebitda || null,
            dividendYield: defaultKeyStatistics.yield || summaryDetail.dividendYield || null,
            grossMargin: financialData.grossMargins || null,
            operatingMargin: financialData.operatingMargins || null,
            profitMargin: financialData.profitMargins || null,
            returnOnAssets: financialData.returnOnAssets || null,
            returnOnEquity: financialData.returnOnEquity || null,
            totalRevenue: financialData.totalRevenue || null,
            costOfRevenue: financialData.costOfRevenue || null,
            netIncome: financialData.netIncome || null,
            cash: financialData.totalCash || null,
            shortTermDebt: financialData.shortTermDebt || null,
            longTermDebt: financialData.longTermDebt || null,
            totalCashFromOperatingActivities: financialData.totalCashFromOperatingActivities || null,
            totalCashflowsFromInvestingActivities: financialData.totalCashflowsFromInvestingActivities || null,
            totalCashFromFinancingActivities: financialData.totalCashFromFinancingActivities || null,
            freeCashflow: financialData.freeCashflow || null,
            regularMarketPrice: price.regularMarketPrice || null,
            regularMarketChange: price.regularMarketChange || null,
            regularMarketChangePercent: price.regularMarketChangePercent || null,
            marketCap: price.marketCap || null,
            fiftyTwoWeekChange: price.fiftyTwoWeekChange || null,
            oneYearTargetEstimate: defaultKeyStatistics.oneYearTargetEstimate || null,
            // We're not using these endpoints as they don't exist in the package
            quarterly_earnings: [],
            recommendations: []
        };

        res.json(stockData);
    } catch (error) {
        console.error('Error fetching stock data:', error);
        res.status(500).json({ error: 'Failed to fetch stock data', message: error.message });
    }
});

// Market overview endpoint
app.get('/api/market/overview', async (req, res) => {
    try {
        const indices = ['^GSPC', '^IXIC', '^DJI']; // S&P 500, NASDAQ, DOW
        const marketData = [];
        
        // Fetch each index separately to avoid Promise.all failing completely if one fails
        for (const symbol of indices) {
            try {
                const quote = await yahooFinance.quote(symbol);
                marketData.push({
                    symbol: quote.symbol,
                    price: quote.regularMarketPrice,
                    change: quote.regularMarketChange,
                    changePercent: quote.regularMarketChangePercent
                });
            } catch (err) {
                console.error(`Error fetching data for ${symbol}:`, err);
                // Add a placeholder with error info
                marketData.push({
                    symbol: symbol,
                    price: null,
                    change: null,
                    changePercent: null,
                    error: true
                });
            }
        }

        res.json(marketData);
    } catch (error) {
        console.error('Error fetching market overview:', error);
        res.status(500).json({ error: 'Failed to fetch market overview', message: error.message });
    }
});

// Add a healthcheck endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Server is running' });
});

// Add a root endpoint to confirm the API is working
app.get('/', (req, res) => {
  res.status(200).json({ 
    message: 'StockXpert API is running', 
    endpoints: [
      '/api/market/overview',
      '/api/stock/:symbol',
      '/health'
    ] 
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!', message: err.message });
});

// Handle uncaught promise rejections to prevent server crash
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Keep the server running even if there are unhandled rejections
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 
