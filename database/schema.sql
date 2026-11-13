-- Non-destructive bootstrap; existing tables are not migrated by this file.
SET NAMES utf8mb4;
CREATE TABLE IF NOT EXISTS users (
 id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
 email VARCHAR(200) NOT NULL,
 password_hash VARCHAR(100) NOT NULL,
 role VARCHAR(20) NOT NULL DEFAULT 'EMPLOYEE',
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 UNIQUE KEY uk_users_email (email),
 CONSTRAINT ck_users_role CHECK (role IN ('EMPLOYEE','ADMIN','SUPER_ADMIN'))
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS dishes (
 id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
 name VARCHAR(200) NOT NULL,
 description VARCHAR(2000) NOT NULL,
 price_fen BIGINT NOT NULL,
 category VARCHAR(40) NOT NULL,
 image_url VARCHAR(500) NOT NULL,
 proteins_json JSON NOT NULL,
 allergens_json JSON NOT NULL,
 spice_level VARCHAR(10) NOT NULL DEFAULT 'None',
 option_groups_json JSON NOT NULL,
 active BOOLEAN NOT NULL DEFAULT TRUE,
 CONSTRAINT ck_dishes_price CHECK (price_fen >= 0),
 CONSTRAINT ck_dishes_category CHECK (category IN ('Chinese','Western','Japanese','Light Meal','Korean','Southeast Asian')),
 CONSTRAINT ck_dishes_spice CHECK (spice_level IN ('None','Mild','Medium','Hot'))
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS daily_menu_items (
 id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
 menu_date DATE NOT NULL,
 dish_id BIGINT NOT NULL,
 UNIQUE KEY uk_daily_menu_date_dish (menu_date,dish_id),
 CONSTRAINT fk_daily_menu_dish FOREIGN KEY (dish_id) REFERENCES dishes(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS orders (
 id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
 order_no VARCHAR(40) NOT NULL,
 user_id BIGINT NOT NULL,
 request_id VARCHAR(36) NOT NULL,
 request_hash CHAR(64) NOT NULL,
 delivery_date DATE NOT NULL,
 meal_period VARCHAR(10) NOT NULL,
 address VARCHAR(200) NOT NULL,
 status VARCHAR(20) NOT NULL DEFAULT 'Pending',
 total_fen BIGINT NOT NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 UNIQUE KEY uk_orders_no (order_no),
 UNIQUE KEY uk_orders_user_request (user_id,request_id),
 KEY idx_orders_user_created (user_id,created_at,id),
 CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id),
 CONSTRAINT ck_orders_total CHECK (total_fen >= 0),
 CONSTRAINT ck_orders_meal CHECK (meal_period IN ('Lunch','Dinner')),
 CONSTRAINT ck_orders_status CHECK (status IN ('Pending','Confirmed','Completed','Cancelled'))
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS order_items (
 id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
 order_id BIGINT NOT NULL,
 dish_id BIGINT NOT NULL,
 dish_name VARCHAR(200) NOT NULL,
 options_json JSON NOT NULL,
 unit_price_fen BIGINT NOT NULL,
 quantity INT NOT NULL,
 subtotal_fen BIGINT NOT NULL,
 KEY idx_order_items_order (order_id),
 CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id),
 CONSTRAINT fk_order_items_dish FOREIGN KEY (dish_id) REFERENCES dishes(id),
 CONSTRAINT ck_order_items_quantity CHECK (quantity > 0),
 CONSTRAINT ck_order_items_price CHECK (unit_price_fen >= 0 AND subtotal_fen >= 0),
 CONSTRAINT ck_order_items_subtotal CHECK (subtotal_fen = unit_price_fen * quantity)
) ENGINE=InnoDB;
