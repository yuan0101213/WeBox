SET NAMES utf8mb4;
CREATE TABLE IF NOT EXISTS user_preferences (
 user_id BIGINT NOT NULL PRIMARY KEY,
 preferences_json JSON NOT NULL,
 CONSTRAINT fk_preferences_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='daily_menu_items' AND column_name='supply_quantity')=0,'ALTER TABLE daily_menu_items ADD COLUMN supply_quantity INT NOT NULL DEFAULT 50','SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='orders' AND column_name='active_slot')=0,"ALTER TABLE orders ADD COLUMN active_slot TINYINT GENERATED ALWAYS AS (CASE WHEN status IN ('Pending','Confirmed') THEN 1 ELSE NULL END) STORED",'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='orders' AND index_name='uk_orders_active_slot')=0,'ALTER TABLE orders ADD UNIQUE KEY uk_orders_active_slot(user_id,delivery_date,meal_period,active_slot)','SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Only SUPER_ADMIN may enter Console; preserve ADMIN as an unprivileged Console role.
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.check_constraints WHERE constraint_schema=DATABASE() AND constraint_name='ck_users_role' AND check_clause LIKE '%SUPER_ADMIN%')=0,"ALTER TABLE users DROP CHECK ck_users_role, ADD CONSTRAINT ck_users_role CHECK (role IN ('EMPLOYEE','ADMIN','SUPER_ADMIN'))",'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
