from fastapi import APIRouter
import pandas as pd
from ml.model import get_model
from routes.schemas import SalesDataInput, ClusterResponse

router = APIRouter()

@router.post("/", response_model=ClusterResponse)
def cluster(data: SalesDataInput):
    model = get_model()  # Get singleton instance
    df = pd.DataFrame([data.dict()])
    cluster_id = model.cluster(df)
    return {"cluster": cluster_id}
