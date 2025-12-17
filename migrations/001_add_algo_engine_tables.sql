-- Migration: Add core algo engine tables for webhook-based trading
-- Date: 2025-12-17
-- Description: Adds positions, signal_logs, execution_logs, instrument_mappings, and SL/TP columns

USE algo_trading_db;

-- =====================================================================
-- 1. POSITIONS TABLE (track open/closed positions per user-strategy)
-- =====================================================================
CREATE TABLE IF NOT EXISTS `positions` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `userId` INT UNSIGNED NOT NULL,
  `strategyId` INT UNSIGNED NOT NULL,
  `segment` ENUM('Indian','Forex','Crypto') NOT NULL,
  `canonicalSymbol` VARCHAR(100) NOT NULL,
  `brokerSymbol` VARCHAR(100) DEFAULT NULL,
  `side` ENUM('LONG','SHORT') NOT NULL,
  `qty` DECIMAL(20,8) NOT NULL,
  
  -- Entry details
  `entryOrderId` VARCHAR(100) DEFAULT NULL,
  `entryPrice` DECIMAL(20,8) NOT NULL,
  `entryAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- Exit details
  `exitOrderId` VARCHAR(100) DEFAULT NULL,
  `exitPrice` DECIMAL(20,8) DEFAULT NULL,
  `exitAt` DATETIME DEFAULT NULL,
  `exitReason` ENUM('SIGNAL_0','REVERSAL','SL','TP','MANUAL','ERROR') DEFAULT NULL,
  
  -- SL/TP tracking (computed at entry time for this position)
  `slPrice` DECIMAL(20,8) DEFAULT NULL,
  `tpPrice` DECIMAL(20,8) DEFAULT NULL,
  
  -- Status
  `status` ENUM('OPEN','CLOSED') NOT NULL DEFAULT 'OPEN',
  
  -- Metadata
  `pnl` DECIMAL(15,2) DEFAULT NULL,
  `pnlPercentage` DECIMAL(7,2) DEFAULT NULL,
  `metadata` JSON DEFAULT NULL,
  
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Indexes
  KEY `idx_user_strategy` (`userId`, `strategyId`),
  KEY `idx_status` (`status`),
  KEY `idx_segment` (`segment`),
  KEY `idx_side` (`side`),
  
  -- Foreign keys
  CONSTRAINT `fk_position_user` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_position_strategy` FOREIGN KEY (`strategyId`) REFERENCES `strategies`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- 2. SIGNAL_LOGS TABLE (webhook deduplication + audit)
-- =====================================================================
CREATE TABLE IF NOT EXISTS `signal_logs` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `strategyId` INT UNSIGNED NOT NULL,
  `segment` ENUM('Indian','Forex','Crypto') NOT NULL,
  `canonicalSymbol` VARCHAR(100) NOT NULL,
  `signal` TINYINT NOT NULL COMMENT '1=LONG, -1=SHORT, 0=FLAT',
  
  -- Idempotency key (unique per signal to avoid duplicates)
  `signalId` VARCHAR(255) DEFAULT NULL,
  `payloadHash` VARCHAR(64) DEFAULT NULL COMMENT 'SHA256 hash for dedupe if no signalId',
  
  -- Raw data
  `payload` JSON DEFAULT NULL,
  `source` VARCHAR(50) DEFAULT 'tradingview',
  
  `receivedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes
  UNIQUE KEY `idx_signal_id` (`signalId`),
  KEY `idx_payload_hash` (`payloadHash`),
  KEY `idx_strategy_received` (`strategyId`, `receivedAt`),
  
  CONSTRAINT `fk_signal_strategy` FOREIGN KEY (`strategyId`) REFERENCES `strategies`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- 3. EXECUTION_LOGS TABLE (per-user execution decision audit)
-- =====================================================================
CREATE TABLE IF NOT EXISTS `execution_logs` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `signalLogId` INT UNSIGNED DEFAULT NULL,
  `userId` INT UNSIGNED NOT NULL,
  `strategyId` INT UNSIGNED NOT NULL,
  
  -- Decision made
  `decision` ENUM('ENTER','EXIT','REVERSE','SKIP','ERROR') NOT NULL,
  `reason` VARCHAR(255) DEFAULT NULL COMMENT 'e.g. NO_POSITION, SLTP_MODE, FORCE_EXIT, etc.',
  
  -- Context
  `currentSide` ENUM('FLAT','LONG','SHORT') DEFAULT 'FLAT',
  `targetSide` ENUM('FLAT','LONG','SHORT') NOT NULL,
  
  -- Metadata
  `metadata` JSON DEFAULT NULL,
  
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes
  KEY `idx_signal_log` (`signalLogId`),
  KEY `idx_user_strategy` (`userId`, `strategyId`),
  KEY `idx_decision` (`decision`),
  
  CONSTRAINT `fk_execution_signal` FOREIGN KEY (`signalLogId`) REFERENCES `signal_logs`(`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_execution_user` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_execution_strategy` FOREIGN KEY (`strategyId`) REFERENCES `strategies`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- 4. INSTRUMENT_MAPPINGS TABLE (canonical symbol -> broker symbol)
-- =====================================================================
CREATE TABLE IF NOT EXISTS `instrument_mappings` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `userId` INT UNSIGNED NOT NULL,
  `segment` ENUM('Indian','Forex','Crypto') NOT NULL,
  `broker` VARCHAR(100) NOT NULL,
  
  -- Canonical symbol (engine standard)
  `canonicalSymbol` VARCHAR(100) NOT NULL,
  
  -- Broker-specific symbol/token
  `brokerSymbol` VARCHAR(100) NOT NULL,
  `brokerToken` VARCHAR(100) DEFAULT NULL COMMENT 'For Indian brokers like Angel One',
  
  -- Metadata
  `metadata` JSON DEFAULT NULL,
  
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Unique constraint: one mapping per user-broker-canonical combo
  UNIQUE KEY `idx_user_broker_symbol` (`userId`, `broker`, `canonicalSymbol`),
  
  CONSTRAINT `fk_mapping_user` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- 5. ALTER StrategySubscriptions: Add per-user qty and SL/TP fields
-- =====================================================================
ALTER TABLE `StrategySubscriptions`
  ADD COLUMN `qty` DECIMAL(20,8) DEFAULT NULL COMMENT 'Fixed quantity to execute (overrides lots if set)',
  ADD COLUMN `slEnabled` TINYINT(1) DEFAULT 0 COMMENT 'Stop Loss enabled?',
  ADD COLUMN `slType` ENUM('POINTS','PERCENT') DEFAULT 'POINTS',
  ADD COLUMN `slValue` DECIMAL(10,4) DEFAULT NULL COMMENT 'SL value in points or percent',
  ADD COLUMN `tpEnabled` TINYINT(1) DEFAULT 0 COMMENT 'Take Profit enabled?',
  ADD COLUMN `tpType` ENUM('POINTS','PERCENT') DEFAULT 'POINTS',
  ADD COLUMN `tpValue` DECIMAL(10,4) DEFAULT NULL COMMENT 'TP value in points or percent',
  ADD COLUMN `exitMode` ENUM('SIGNAL_ONLY','SLTP') DEFAULT 'SIGNAL_ONLY' COMMENT 'Exit behavior mode';

-- Add index for better query performance
ALTER TABLE `StrategySubscriptions`
  ADD KEY `idx_exit_mode` (`exitMode`);

-- =====================================================================
-- 6. ORDER_LOGS TABLE (broker order request/response audit)
-- =====================================================================
CREATE TABLE IF NOT EXISTS `order_logs` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `userId` INT UNSIGNED NOT NULL,
  `strategyId` INT UNSIGNED DEFAULT NULL,
  `positionId` INT UNSIGNED DEFAULT NULL,
  
  -- Order details
  `broker` VARCHAR(100) NOT NULL,
  `orderType` ENUM('ENTRY','EXIT','SL','TP') NOT NULL,
  `side` ENUM('BUY','SELL') NOT NULL,
  `symbol` VARCHAR(100) NOT NULL,
  `qty` DECIMAL(20,8) NOT NULL,
  `orderMode` ENUM('MARKET','LIMIT') DEFAULT 'MARKET',
  `limitPrice` DECIMAL(20,8) DEFAULT NULL,
  
  -- Broker response
  `brokerOrderId` VARCHAR(100) DEFAULT NULL,
  `status` ENUM('PENDING','SUBMITTED','FILLED','PARTIAL','REJECTED','CANCELLED') DEFAULT 'PENDING',
  `fillPrice` DECIMAL(20,8) DEFAULT NULL,
  `fillQty` DECIMAL(20,8) DEFAULT NULL,
  `fillTime` DATETIME DEFAULT NULL,
  
  -- Request/response raw data
  `requestPayload` JSON DEFAULT NULL,
  `responsePayload` JSON DEFAULT NULL,
  `errorMessage` TEXT DEFAULT NULL,
  
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Indexes
  KEY `idx_user` (`userId`),
  KEY `idx_strategy` (`strategyId`),
  KEY `idx_position` (`positionId`),
  KEY `idx_broker_order` (`brokerOrderId`),
  KEY `idx_status` (`status`),
  
  CONSTRAINT `fk_order_user` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_order_strategy` FOREIGN KEY (`strategyId`) REFERENCES `strategies`(`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_order_position` FOREIGN KEY (`positionId`) REFERENCES `positions`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- END OF MIGRATION
-- =====================================================================
