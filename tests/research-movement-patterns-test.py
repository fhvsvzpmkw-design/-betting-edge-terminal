import importlib.util
import pathlib
import unittest

p=pathlib.Path(__file__).resolve().parents[1]/'tools/research-movement-patterns.py'
s=importlib.util.spec_from_file_location('movement',p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)

class MovementTests(unittest.TestCase):
    def frame(self,at='2026-09-01T18:00:00Z',market='x'):
        return {'marketId':market,'eventKey':'MLB|123|2026-09-01T20:00:00Z','at':at,'pinnacle':{'p':.55},
                'books':{'bet365':{'anchor':{'price':2},'opposite':{'price':1.8}},
                         'draftkings':{'anchor':{'price':1.9},'opposite':{'price':1.9}}}}
    def test_direction_and_reference_complement(self):
        f=self.frame()
        self.assertAlmostEqual(m.edge(f,'bet365','home'),5)
        self.assertLess(m.edge(f,'bet365','away'),0)
        self.assertGreater(m.book_gap(f,'bet365','home'),0)
        self.assertLess(m.book_gap(f,'bet365','away'),0)
        self.assertAlmostEqual(m.ref_probability(f,'home')+m.ref_probability(f,'away'),1)
    def test_later_price_cannot_cross_line_event_or_start(self):
        row={'marketId':'x','eventKey':'MLB|123|2026-09-01T20:00:00Z','entryAt':'2026-09-01T18:00:00Z',
             'book':'bet365','side':'home','price':2}
        valid=self.frame('2026-09-01T19:00:00Z');valid['books']['bet365']['anchor']['price']=1.9
        bad_line=self.frame('2026-09-01T19:30:00Z','otherline')
        post=self.frame('2026-09-01T20:01:00Z')
        before=self.frame('2026-09-01T17:00:00Z')
        m.add_later(row,[valid,bad_line,post,before])
        self.assertEqual(row['laterPrice']['at'],valid['at'])
        self.assertTrue(row['laterPrice']['entryBeatLater'])
    def test_missing_later_quote_stays_missing(self):
        r={'marketId':'x','eventKey':'MLB|123|2026-09-01T20:00:00Z','entryAt':'2026-09-01T18:00:00Z',
           'book':'bet365','side':'home','price':2}
        m.add_later(r,[self.frame('2026-09-01T20:01:00Z')]);self.assertEqual(r['laterPrice']['state'],'unavailable')
    def test_reference_residual_excludes_pushes(self):
        rs=[{'grade':'WIN','referenceP':.6,'eventKey':'a'},
            {'grade':'LOSS','referenceP':.4,'eventKey':'b'},
            {'grade':'PUSH','referenceP':.9,'eventKey':'c'}]
        d=m.outcome_residual(rs);self.assertEqual(d['resolvedEntries'],2)
        self.assertAlmostEqual(d['winRateMinusReferencePp'],0)

if __name__=='__main__':unittest.main()
