-- Trigger function: sends pg_notify on entity changes
CREATE OR REPLACE FUNCTION notify_entity_change() RETURNS trigger AS $$
DECLARE
  row_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    row_id := OLD.id;
  ELSE
    row_id := NEW.id;
  END IF;

  PERFORM pg_notify('entity_change', json_build_object(
    'table', TG_TABLE_NAME,
    'op', TG_OP,
    'id', row_id
  )::text);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE TRIGGER tasks_entity_change
  AFTER INSERT OR UPDATE OR DELETE ON tasks
  FOR EACH ROW EXECUTE FUNCTION notify_entity_change();--> statement-breakpoint

CREATE TRIGGER subtasks_entity_change
  AFTER INSERT OR UPDATE OR DELETE ON subtasks
  FOR EACH ROW EXECUTE FUNCTION notify_entity_change();--> statement-breakpoint

CREATE TRIGGER captures_entity_change
  AFTER INSERT OR UPDATE OR DELETE ON captures
  FOR EACH ROW EXECUTE FUNCTION notify_entity_change();
