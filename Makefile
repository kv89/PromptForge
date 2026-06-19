.PHONY: backend-dev frontend-dev dev backend-test docker-up docker-down install

backend-dev:
	cd backend && .venv/bin/uvicorn app.main:app --reload

frontend-dev:
	cd frontend && npm run dev

dev:
	$(MAKE) backend-dev & $(MAKE) frontend-dev & wait

backend-test:
	cd backend && pytest

docker-up:
	docker compose up --build

docker-down:
	docker compose down

install:
	cd backend && pip install -r requirements.txt
	cd frontend && npm install
