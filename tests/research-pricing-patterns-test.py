import importlib.util
import pathlib
import unittest

path=pathlib.Path(__file__).resolve().parents[1]/'tools/research-pricing-patterns.py'
spec=importlib.util.spec_from_file_location('study',path)
study=importlib.util.module_from_spec(spec);spec.loader.exec_module(study)

class PricingTests(unittest.TestCase):
    def test_settlement(self):
        self.assertAlmostEqual(study.units('WIN',2.25),1.25)
        self.assertEqual(study.units('LOSS',2.25),-1)
        self.assertEqual(study.units('PUSH',2.25),0)
        self.assertAlmostEqual(study.units('HALF_WIN',2.25),.625)
        self.assertEqual(study.units('HALF_LOSS',2.25),-.5)
        self.assertIsNone(study.units(None,2.25))
    def test_unresolved_is_not_a_loss(self):
        rows=[{'eventKey':'a','netUnits':1,'grade':'WIN'},
              {'eventKey':'b','netUnits':None,'grade':None},
              {'eventKey':'c','netUnits':0,'grade':'PUSH'}]
        s=study.summary(rows,bootstrap=False)
        self.assertEqual((s['settled'],s['unresolved'],s['roiPct']),(2,1,50))
    def test_same_event_multiple_markets_cluster(self):
        rows=[{'eventKey':'a','netUnits':1,'grade':'WIN'},
              {'eventKey':'a','netUnits':-1,'grade':'LOSS'},
              {'eventKey':'b','netUnits':1,'grade':'WIN'}]
        self.assertEqual(study.summary(rows)['events'],2)
    def test_reused_event_id_different_start(self):
        a={'sport':'MLB','eventId':'1','commenceTime':'2026-09-01T20:00:00Z'}
        b=dict(a,commenceTime='2026-09-02T20:00:00Z')
        self.assertNotEqual(study.event_key(a),study.event_key(b))
    def test_split(self):
        self.assertEqual(study.phase('2026-09-20'),'discovery')
        self.assertEqual(study.phase('2026-09-21'),'validation')

if __name__=='__main__':unittest.main()
